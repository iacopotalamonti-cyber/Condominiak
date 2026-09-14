import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { SpeseChart } from "@/components/dashboard/SpeseChart";
import { AggiungiBilancio } from "@/components/dashboard/AggiungiBilancio";
import { AnnoSelector } from "@/components/dashboard/AnnoSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FonteLink } from "@/components/estrazione/FonteLink";
import { CATEGORIE_SPESA_LABEL, formatEuro } from "@/lib/condotwin-calculations";
import { TOLLERANZA_QUADRATURA } from "@/lib/anthropic";
import type { Bilancio, Spesa } from "@/lib/types";

export default async function SpesePage({
  searchParams,
}: {
  searchParams: Promise<{ anno?: string }>;
}) {
  const { role, condominium } = await getDashboardContext();
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
  const anni = Array.from(new Set(spese.map((s) => s.anno))).sort((a, b) => b - a);

  const { anno: annoParam } = await searchParams;
  const annoRichiesto = Number(annoParam);
  const annoSelezionato = anni.includes(annoRichiesto)
    ? annoRichiesto
    : anni.includes(annoCorrente)
      ? annoCorrente
      : anni[0];

  const speseAnno = spese.filter((s) => s.anno === annoSelezionato);
  const totale = speseAnno.reduce((sum, s) => sum + s.importo, 0);

  // Il totale stampato sul documento, quando è stato registrato: confrontarlo
  // con la somma delle voci dice in un colpo d'occhio se l'estrazione ha perso
  // o duplicato qualcosa.
  const bilancioAnno = bilanci.find((b) => b.anno === annoSelezionato);
  const totaleDocumento = bilancioAnno?.totale_documento ?? null;
  const scostamento = totaleDocumento ? totale - totaleDocumento : 0;
  const quadra = Math.abs(scostamento) <= TOLLERANZA_QUADRATURA;

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

      {speseAnno.length === 0 ? (
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
              Totale: {formatEuro(totale)}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {totaleDocumento !== null && !quadra && (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                La somma delle voci ({formatEuro(totale)}) non corrisponde al totale stampato nel
                documento ({formatEuro(totaleDocumento)}): differenza di{" "}
                {formatEuro(Math.abs(scostamento))}. Ricarica il bilancio di quest&apos;anno per
                rivedere le voci.
              </p>
            )}
            <SpeseChart spese={speseAnno} />
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
                      percorso={s.documento_path}
                    />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {role === "admin" && (
        <AggiungiBilancio condominiumId={condominium.id} anniEsistenti={anni} />
      )}
    </div>
  );
}
