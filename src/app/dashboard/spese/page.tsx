import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { SpeseChart } from "@/components/dashboard/SpeseChart";
import { AggiungiBilancio } from "@/components/dashboard/AggiungiBilancio";
import { AnnoSelector } from "@/components/dashboard/AnnoSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FonteLink } from "@/components/estrazione/FonteLink";
import { CATEGORIE_SPESA_LABEL, formatEuro } from "@/lib/calcoli";
import { ORIGINE_TOTALE_LABEL, esercizi } from "@/lib/bilancio";
import { documentiArchiviati } from "@/lib/documenti-archivio";
import type { Bilancio, Spesa } from "@/lib/types";

export default async function SpesePage({
  searchParams,
}: {
  searchParams: Promise<{ anno?: string }>;
}) {
  const { role, condominium, userId } = await getDashboardContext();
  const supabase = await createClient();
  const annoCorrente = new Date().getFullYear();

  const [{ data }, { data: datiBilanci }] = await Promise.all([
    supabase
      .from("spese")
      .select("*")
      .eq("condominium_id", condominium.id)
      .order("anno", { ascending: false }),
    supabase
      .from("bilanci")
      .select("*")
      .eq("condominium_id", condominium.id),
  ]);

  const spese = (data ?? []) as Spesa[];
  const bilanci = (datiBilanci ?? []) as Bilancio[];

  // Un solo calcolo del totale per tutte le pagine: qui si sceglie solo quale
  // esercizio mostrare.
  const tuttiEsercizi = esercizi(bilanci, spese);
  const anni = tuttiEsercizi.map((e) => e.anno);

  // I documenti caricati in passato restano in archivio: rileggerli non
  // richiede di ricaricarli, e serve quando l'estrazione è migliorata.
  const archiviati = await documentiArchiviati(userId, bilanci);

  const { anno: annoParam } = await searchParams;
  const annoRichiesto = Number(annoParam);
  const annoSelezionato = anni.includes(annoRichiesto)
    ? annoRichiesto
    : anni.includes(annoCorrente)
      ? annoCorrente
      : anni[0];

  const speseAnno = spese.filter((s) => s.anno === annoSelezionato);
  const esercizio = tuttiEsercizi.find((e) => e.anno === annoSelezionato);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Analisi spese</h1>
          <p className="text-sm text-muted-foreground">
            Ripartizione delle voci di spesa {annoSelezionato ? `— anno ${annoSelezionato}` : ""}
          </p>
        </div>
        {anni.length > 1 && <AnnoSelector anni={anni} selezionato={annoSelezionato} />}
      </div>

      {!esercizio || (speseAnno.length === 0 && !esercizio.totale) ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nessuna voce di spesa registrata.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Spese per categoria</CardTitle>
            <span className="text-sm font-medium text-muted-foreground">
              Totale esercizio: {formatEuro(esercizio.totale)}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {esercizio.nonClassificato > 0 && (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                Di {formatEuro(esercizio.totale)} spesi, {formatEuro(esercizio.sommaVoci)} sono
                ricondotti a una categoria: {formatEuro(esercizio.nonClassificato)} non lo sono
                ancora. Ricarica il bilancio di quest&apos;anno per classificarli.
              </p>
            )}
            {esercizio.eccedenza > 0 && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Le voci sommano {formatEuro(esercizio.sommaVoci)}, più del totale dell&apos;esercizio
                ({formatEuro(esercizio.totale)}): {formatEuro(esercizio.eccedenza)} sono contati due
                volte. Ricarica il bilancio per correggerli.
              </p>
            )}
            <SpeseChart spese={speseAnno} nonClassificato={esercizio.nonClassificato} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 sm:grid-cols-3">
              {[...speseAnno]
                .sort((a, b) => b.importo - a.importo)
                .map((s) => (
                  <div key={s.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {CATEGORIE_SPESA_LABEL[s.categoria] ?? s.categoria}
                      </span>
                      <span className="font-medium tabular-nums">{formatEuro(s.importo)}</span>
                    </div>
                    <FonteLink
                      pagina={s.fonte_pagina}
                      testo={s.fonte_testo}
                      verificata={s.fonte_verificata}
                      verificabile={s.fonte_verificabile}
                      percorso={s.documento_path}
                    />
                  </div>
                ))}
              {esercizio.nonClassificato > 0 && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-warning">Non classificato</span>
                    <span className="font-medium tabular-nums text-warning">
                      {formatEuro(esercizio.nonClassificato)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    presente nel totale, non in una categoria
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Totale dell&apos;esercizio preso dal {ORIGINE_TOTALE_LABEL[esercizio.origine]}.
            </p>
          </CardContent>
        </Card>
      )}

      {role === "admin" && (
        <AggiungiBilancio
          condominiumId={condominium.id}
          anniEsistenti={anni}
          archiviati={archiviati}
        />
      )}
    </div>
  );
}

// I file in storage sono salvati come "<prefisso>/<utente>/<uuid>-<nome vero>":
// all'amministratore va mostrato il nome che ha caricato lui. Il prefisso è un
// UUID, che contiene trattini: va tolto per intero, non fino al primo trattino.
