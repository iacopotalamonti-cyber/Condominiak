import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { BilancioChart } from "@/components/dashboard/BilancioChart";
import { FondoRiservaChart } from "@/components/dashboard/FondoRiservaChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FonteLink } from "@/components/estrazione/FonteLink";
import { formatEuro, variazioneAnnua } from "@/lib/condotwin-calculations";
import { esercizi } from "@/lib/bilancio";
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
    supabase.from("spese").select("*").eq("condominium_id", condominium.id),
  ]);

  const bilanci = (data ?? []) as Bilancio[];
  const spese = (datiSpese ?? []) as Spesa[];

  // Stesso calcolo di Analisi spese e della dashboard: il totale di un
  // esercizio è uno solo, da qualunque pagina lo si guardi.
  const perAnno = new Map(esercizi(bilanci, spese).map((e) => [e.anno, e]));

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
                    <TableHead>Totale esercizio</TableHead>
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
                      ? variazioneAnnua(
                          perAnno.get(b.anno)?.totale ?? 0,
                          perAnno.get(precedente.anno)?.totale ?? 0
                        )
                      : "—";
                    const esercizio = perAnno.get(b.anno);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.anno}</TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatEuro(esercizio?.totale)}
                        </TableCell>
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
                          {!esercizio || !esercizio.totale ? (
                            <span className="text-xs text-muted-foreground">non verificabile</span>
                          ) : esercizio.quadra ? (
                            <Badge variant="success">i conti tornano</Badge>
                          ) : esercizio.nonClassificato ? (
                            <Badge variant="warning">
                              {formatEuro(esercizio.nonClassificato)} non classificati
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              {formatEuro(esercizio.eccedenza)} contati due volte
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
