import { Receipt, Truck, Undo2 } from "lucide-react";

import { FornitoriChart } from "@/components/dashboard/FornitoriChart";
import { KPICard } from "@/components/dashboard/KPICard";
import { FonteLink } from "@/components/estrazione/FonteLink";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIE_SPESA_LABEL, formatEuro, formatEuroPreciso } from "@/lib/calcoli";
import { SENZA_FORNITORE, type TotaleFornitore } from "@/lib/fornitori";

interface RiepilogoFornitoriProps {
  fornitori: TotaleFornitore[];
  righe: number;
  mostraTutti: boolean;
}

/**
 * Chi è stato pagato, e quanto.
 *
 * Le righe senza fornitore stanno a parte. Sono soprattutto gli storni delle
 * quote a contatore (nel 2024 -10.359 €): mescolate ai fornitori facevano
 * partire le barre del grafico da metà, davano percentuali oltre il 100% e un
 * "totale movimenti" che non era quanto si è pagato a nessuno.
 */
export function RiepilogoFornitori({ fornitori, righe, mostraTutti }: RiepilogoFornitoriProps) {
  const pagati = fornitori.filter((f) => f.attribuito);
  const senzaFornitore = fornitori.find((f) => !f.attribuito);
  const totalePagato = pagati.reduce((t, f) => t + f.totale, 0);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label="Fornitori" value={String(pagati.length)} icon={Truck} />
        <KPICard
          label="Pagato ai fornitori"
          value={formatEuro(totalePagato)}
          hint={`${righe} righe di documento`}
          icon={Receipt}
        />
        <KPICard
          label="Righe senza fornitore"
          value={String(senzaFornitore?.movimenti.length ?? 0)}
          hint={
            senzaFornitore
              ? `saldo ${formatEuro(senzaFornitore.totale)}: storni a contatore e rettifiche`
              : "ogni riga ha una controparte"
          }
          icon={Undo2}
          tone={senzaFornitore ? "warning" : "success"}
        />
      </div>

      {pagati.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spesa per fornitore</CardTitle>
          </CardHeader>
          <CardContent>
            <FornitoriChart voci={pagati.map((f) => ({ fornitore: f.nome, totale: f.totale }))} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dettaglio</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {[...pagati, ...(senzaFornitore ? [senzaFornitore] : [])].map((f) => (
            <details key={f.id ?? f.nome} className="rounded-md border px-3 py-2">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={
                      f.attribuito ? "truncate font-medium" : "truncate font-medium text-warning"
                    }
                    title={f.nome}
                  >
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
                <span className="flex shrink-0 items-center gap-3">
                  {f.attribuito && totalePagato > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round((f.totale / totalePagato) * 100)}%
                    </span>
                  )}
                  <span className="font-medium tabular-nums">{formatEuro(f.totale)}</span>
                </span>
              </summary>

              {!f.attribuito && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Righe che non nominano una controparte. Le più grandi sono gli storni: il
                  consumo di acqua e riscaldamento, pagato al fornitore, viene tolto dal riparto
                  generale e addebitato a ciascuno secondo il proprio contatore.
                </p>
              )}

              <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
                {f.movimenti.map((m) => (
                  <li key={m.id} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-muted-foreground">
                        {m.data ? `${formatData(m.data)} — ` : ""}
                        {m.descrizione || CATEGORIE_SPESA_LABEL[m.categoria] || m.categoria}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatEuroPreciso(Number(m.importo))}
                      </span>
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

      {senzaFornitore && (
        <p className="text-xs text-muted-foreground">
          «{SENZA_FORNITORE}» raccoglie le righe senza controparte: storni delle quote a contatore,
          rettifiche, conguagli. Restano nei totali di Analisi spese, ma non sono un pagamento a
          qualcuno.
        </p>
      )}
    </>
  );
}

function formatData(data: string): string {
  const [anno, mese, giorno] = data.split("-");
  return `${giorno}/${mese}/${anno}`;
}
