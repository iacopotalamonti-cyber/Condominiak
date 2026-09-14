import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { BilancioChart } from "@/components/dashboard/BilancioChart";
import { FondoRiservaChart } from "@/components/dashboard/FondoRiservaChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FonteLink } from "@/components/estrazione/FonteLink";
import { formatEuro, variazioneAnnua } from "@/lib/condotwin-calculations";
import { TOLLERANZA_QUADRATURA } from "@/lib/anthropic";
import type { Bilancio, FonteSalvata, Spesa } from "@/lib/types";

export default async function BilanciPage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();

  const [{ data }, { data: datiSpese }] = await Promise.all([
    supabase
      .from("bilanci")
      .select("*")
      .eq("condominium_id", condominium.id)
      .order("anno", { ascending: false }),
    supabase.from("spese").select("anno, importo").eq("condominium_id", condominium.id),
  ]);

  const bilanci = (data ?? []) as Bilancio[];

  // Somma delle voci registrate per ciascun anno: confrontata con il totale
  // stampato sul documento dice se quell'anno è da ricontrollare.
  const sommaSpesePerAnno = new Map<number, number>();
  for (const spesa of (datiSpese ?? []) as Pick<Spesa, "anno" | "importo">[]) {
    sommaSpesePerAnno.set(spesa.anno, (sommaSpesePerAnno.get(spesa.anno) ?? 0) + spesa.importo);
  }

  function fonteDi(bilancio: Bilancio, campo: string): FonteSalvata | null {
    return bilancio.fonti?.[campo] ?? null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Bilanci 5 anni</h1>
        <p className="text-sm text-muted-foreground">
          Andamento di preventivo, consuntivo e fondo riserva
        </p>
      </div>

      {bilanci.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nessun bilancio registrato per questo condominio.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preventivo vs Consuntivo</CardTitle>
            </CardHeader>
            <CardContent>
              <BilancioChart bilanci={bilanci} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fondo riserva</CardTitle>
            </CardHeader>
            <CardContent>
              <FondoRiservaChart bilanci={bilanci} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dettaglio annuale</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anno</TableHead>
                    <TableHead>Preventivo</TableHead>
                    <TableHead>Consuntivo</TableHead>
                    <TableHead>Fondo riserva</TableHead>
                    <TableHead>Var. consuntivo</TableHead>
                    <TableHead>Quadratura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bilanci.map((b, i) => {
                    const precedente = bilanci[i + 1];
                    const variazione = precedente
                      ? variazioneAnnua(b.consuntivo ?? 0, precedente.consuntivo ?? 0)
                      : "—";
                    const sommaSpese = sommaSpesePerAnno.get(b.anno);
                    const scostamento =
                      b.totale_documento && sommaSpese !== undefined
                        ? sommaSpese - b.totale_documento
                        : null;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.anno}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {formatEuro(b.preventivo)}
                            <FonteLink
                              pagina={fonteDi(b, "prev")?.pagina ?? null}
                              testo={fonteDi(b, "prev")?.testo ?? null}
                              verificata={fonteDi(b, "prev")?.verificata ?? false}
                              percorso={b.documento_path}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {formatEuro(b.consuntivo)}
                            <FonteLink
                              pagina={fonteDi(b, "cons")?.pagina ?? null}
                              testo={fonteDi(b, "cons")?.testo ?? null}
                              verificata={fonteDi(b, "cons")?.verificata ?? false}
                              percorso={b.documento_path}
                            />
                          </div>
                        </TableCell>
                        <TableCell>{formatEuro(b.fondo_riserva)}</TableCell>
                        <TableCell>
                          <Badge variant={variazione.startsWith("+") ? "warning" : "success"}>
                            {variazione}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {scostamento === null ? (
                            <span className="text-xs text-muted-foreground">non verificabile</span>
                          ) : Math.abs(scostamento) <= TOLLERANZA_QUADRATURA ? (
                            <Badge variant="success">i conti tornano</Badge>
                          ) : (
                            <Badge variant="destructive">
                              scarto {formatEuro(Math.abs(scostamento))}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
