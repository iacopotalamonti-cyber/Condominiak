import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { BilancioChart } from "@/components/dashboard/BilancioChart";
import { FondoRiservaChart } from "@/components/dashboard/FondoRiservaChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEuro, variazioneAnnua } from "@/lib/condotwin-calculations";
import type { Bilancio } from "@/lib/types";

export default async function BilanciPage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bilanci")
    .select("*")
    .eq("condominium_id", condominium.id)
    .order("anno", { ascending: false });

  const bilanci = (data ?? []) as Bilancio[];

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bilanci.map((b, i) => {
                    const precedente = bilanci[i + 1];
                    const variazione = precedente
                      ? variazioneAnnua(b.consuntivo ?? 0, precedente.consuntivo ?? 0)
                      : "—";
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.anno}</TableCell>
                        <TableCell>{formatEuro(b.preventivo)}</TableCell>
                        <TableCell>{formatEuro(b.consuntivo)}</TableCell>
                        <TableCell>{formatEuro(b.fondo_riserva)}</TableCell>
                        <TableCell>
                          <Badge variant={variazione.startsWith("+") ? "warning" : "success"}>
                            {variazione}
                          </Badge>
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
