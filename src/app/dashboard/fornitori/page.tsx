import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { AnnoSelector } from "@/components/dashboard/AnnoSelector";
import { RiepilogoFornitori } from "@/components/dashboard/RiepilogoFornitori";
import { EstraiFornitori } from "@/components/dashboard/EstraiFornitori";
import { documentiArchiviati } from "@/lib/documenti-archivio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { perFornitore } from "@/lib/fornitori";
import type { Fornitore, Movimento } from "@/lib/types";

const TUTTI = "tutti";

export default async function FornitoriPage({
  searchParams,
}: {
  searchParams: Promise<{ anno?: string }>;
}) {
  const { role, condominium } = await getDashboardContext();
  const supabase = await createClient();

  const [{ data }, { data: datiFornitori }] = await Promise.all([
    supabase
      .from("movimenti")
      .select("*")
      .eq("condominium_id", condominium.id)
      .order("anno", { ascending: false }),
    supabase.from("fornitori").select("*").eq("condominium_id", condominium.id),
  ]);

  // I documenti già caricati restano in archivio: da qui si rileggono senza
  // doverli ricaricare.
  const { data: datiBilanci } = await supabase
    .from("bilanci")
    .select("anno, documento_path")
    .eq("condominium_id", condominium.id);

  const archiviati = await documentiArchiviati(
    condominium.id,
    (datiBilanci ?? []) as { anno: number; documento_path: string | null }[]
  );

  const movimenti = (data ?? []) as Movimento[];
  const anagrafica = (datiFornitori ?? []) as Fornitore[];
  const decrescente = (a: number, b: number) => b - a;
  const anniConMovimenti = Array.from(new Set(movimenti.map((m) => m.anno))).sort(decrescente);
  // Nel selettore ci sono tutti gli esercizi in archivio, non solo quelli con
  // i movimenti: con un anno solo il filtro sembrava non fare niente, e degli
  // altri anni non si capiva che mancavano.
  const anni = Array.from(
    new Set([...anniConMovimenti, ...(datiBilanci ?? []).map((b) => b.anno as number)])
  ).sort(decrescente);

  const { anno: annoParam } = await searchParams;
  const annoRichiesto = Number(annoParam);
  const selezione = anni.includes(annoRichiesto) ? annoRichiesto : (anniConMovimenti[0] ?? anni[0]);

  // Senza un anno valido nell'URL si mostra l'anno più recente; "tutti" resta
  // una scelta esplicita.
  const mostraTutti = annoParam === TUTTI;
  const visibili = mostraTutti ? movimenti : movimenti.filter((m) => m.anno === selezione);

  const fornitori = perFornitore(visibili, anagrafica);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Fornitori</h1>
          <p className="text-sm text-muted-foreground">
            Chi ha incassato cosa, riga per riga dal rendiconto
            {mostraTutti ? " — tutti gli anni" : selezione ? ` — anno ${selezione}` : ""}
          </p>
        </div>
        {anni.length > 0 && (
          <AnnoSelector
            anni={anni}
            selezionato={mostraTutti ? TUTTI : selezione}
            base="/dashboard/fornitori"
            opzioneTutti={{ valore: TUTTI, etichetta: "Tutti gli anni" }}
          />
        )}
      </div>

      {movimenti.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-10 text-sm text-muted-foreground">
            <p>Nessun movimento registrato.</p>
            <p>
              Il dettaglio per fornitore si ricava dalle singole righe del rendiconto, e quelle
              stanno solo nel documento: quello che è già in archivio sono i totali per categoria,
              non le righe che li compongono.
            </p>
            {role === "admin" && archiviati.length > 0 && (
              <EstraiFornitori
                condominiumId={condominium.id}
                archiviati={archiviati}
                anniConDati={anniConMovimenti}
              />
            )}
          </CardContent>
        </Card>
      ) : visibili.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-10 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Per il {selezione} non ci sono ancora movimenti.</p>
            <p>
              I totali per categoria di questo esercizio ci sono; il dettaglio per fornitore si
              ricava dalle righe del rendiconto. Si ottiene ricaricando il documento da Analisi
              spese, o rileggendolo qui sotto se è già in archivio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <RiepilogoFornitori fornitori={fornitori} righe={visibili.length} mostraTutti={mostraTutti} />
      )}

      {role === "admin" && movimenti.length > 0 && archiviati.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rileggi un documento</CardTitle>
          </CardHeader>
          <CardContent>
            <EstraiFornitori
              condominiumId={condominium.id}
              archiviati={archiviati}
              anniConDati={anniConMovimenti}
            />
          </CardContent>
        </Card>
      )}

    </div>
  );
}
