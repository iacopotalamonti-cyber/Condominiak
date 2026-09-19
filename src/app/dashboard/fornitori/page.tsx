import { Receipt, Truck, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { KPICard } from "@/components/dashboard/KPICard";
import { AnnoSelector } from "@/components/dashboard/AnnoSelector";
import { FornitoriChart } from "@/components/dashboard/FornitoriChart";
import { EstraiFornitori } from "@/components/dashboard/EstraiFornitori";
import { FonteLink } from "@/components/estrazione/FonteLink";
import type { DocumentoArchiviato } from "@/components/dashboard/AggiungiBilancio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIE_SPESA_LABEL,
  formatEuro,
  formatEuroPreciso,
} from "@/lib/condotwin-calculations";
import { SENZA_FORNITORE, perFornitore } from "@/lib/fornitori";
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
    .eq("condominium_id", condominium.id)
    .not("documento_path", "is", null);

  const archiviati: DocumentoArchiviato[] = ((datiBilanci ?? []) as {
    anno: number;
    documento_path: string;
  }[])
    .map((b) => ({ anno: b.anno, nome: nomeFile(b.documento_path), path: b.documento_path }))
    .sort((a, b) => b.anno - a.anno);

  const movimenti = (data ?? []) as Movimento[];
  const anagrafica = (datiFornitori ?? []) as Fornitore[];
  const anni = Array.from(new Set(movimenti.map((m) => m.anno))).sort((a, b) => b - a);

  const { anno: annoParam } = await searchParams;
  const annoRichiesto = Number(annoParam);
  const filtraPerAnno = anni.includes(annoRichiesto);
  const selezione = filtraPerAnno ? annoRichiesto : anni[0];

  // Senza un anno valido nell'URL si mostra l'anno più recente; "tutti" resta
  // una scelta esplicita.
  const mostraTutti = annoParam === TUTTI;
  const visibili = mostraTutti ? movimenti : movimenti.filter((m) => m.anno === selezione);

  const fornitori = perFornitore(visibili, anagrafica);
  const totale = fornitori.reduce((t, f) => t + f.totale, 0);
  const nonAttribuito = fornitori.find((f) => !f.attribuito);
  const conNome = fornitori.filter((f) => f.attribuito);

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
                anniConDati={anni}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard label="Fornitori riconosciuti" value={String(conNome.length)} icon={Truck} />
            <KPICard
              label="Totale movimenti"
              value={formatEuro(totale)}
              hint={`${visibili.length} righe di documento`}
              icon={Receipt}
            />
            <KPICard
              label="Senza fornitore"
              value={formatEuro(nonAttribuito?.totale ?? 0)}
              hint={
                nonAttribuito
                  ? `${nonAttribuito.movimenti.length} righe: consumi, conguagli, giroconti`
                  : "ogni riga ha una controparte"
              }
              icon={TriangleAlert}
              tone={nonAttribuito ? "warning" : "success"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spesa per fornitore</CardTitle>
            </CardHeader>
            <CardContent>
              <FornitoriChart voci={fornitori.map((f) => ({ fornitore: f.nome, totale: f.totale }))} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dettaglio</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {fornitori.map((f) => (
                <details key={f.id ?? f.nome} className="rounded-md border px-3 py-2">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={f.attribuito ? "font-medium" : "font-medium text-warning"}>
                        {f.nome}
                      </span>
                      {f.categorie.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs font-normal">
                          {CATEGORIE_SPESA_LABEL[c] ?? c}
                        </Badge>
                      ))}
                      {mostraTutti && f.anni.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {f.anni[f.anni.length - 1]}–{f.anni[0]}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {totale ? `${Math.round((f.totale / totale) * 100)}%` : ""}
                      </span>
                      <span className="font-medium tabular-nums">{formatEuro(f.totale)}</span>
                    </span>
                  </summary>

                  <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
                    {f.movimenti.map((m) => (
                      <li key={m.id} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            {m.data ? `${formatData(m.data)} — ` : ""}
                            {m.descrizione || CATEGORIE_SPESA_LABEL[m.categoria] || m.categoria}
                          </span>
                          <span className="tabular-nums">{formatEuroPreciso(Number(m.importo))}</span>
                        </div>
                        <FonteLink
                          pagina={m.fonte_pagina}
                          testo={m.fonte_testo}
                          verificata={m.fonte_verificata}
                          verificabile={m.fonte_verificabile}
                          percorso={m.documento_path}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </CardContent>
          </Card>
        </>
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
              anniConDati={anni}
            />
          </CardContent>
        </Card>
      )}

      {nonAttribuito && (
        <p className="text-xs text-muted-foreground">
          «{SENZA_FORNITORE}» raccoglie le righe che non nominano una controparte — consumi a
          contatore, conguagli, giroconti. Restano nel totale perché sono spesa a tutti gli
          effetti.
        </p>
      )}
    </div>
  );
}

function formatData(data: string): string {
  const [anno, mese, giorno] = data.split("-");
  return `${giorno}/${mese}/${anno}`;
}

// I file in storage sono "<prefisso>/<utente>/<uuid>-<nome vero>": il prefisso
// è un UUID e contiene trattini, quindi va tolto per intero.
const PREFISSO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

function nomeFile(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(PREFISSO_UUID, "");
}
