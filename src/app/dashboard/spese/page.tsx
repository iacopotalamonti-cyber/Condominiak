import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { SpeseChart } from "@/components/dashboard/SpeseChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIE_SPESA_LABEL, formatEuro } from "@/lib/condotwin-calculations";
import type { Spesa } from "@/lib/types";

export default async function SpesePage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();
  const annoCorrente = new Date().getFullYear();

  const { data } = await supabase
    .from("spese")
    .select("*")
    .eq("condominium_id", condominium.id)
    .order("anno", { ascending: false });

  const spese = (data ?? []) as Spesa[];
  const anni = Array.from(new Set(spese.map((s) => s.anno))).sort((a, b) => b - a);
  const annoSelezionato = anni.includes(annoCorrente) ? annoCorrente : anni[0];
  const speseAnno = spese.filter((s) => s.anno === annoSelezionato);
  const totale = speseAnno.reduce((sum, s) => sum + s.importo, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analisi spese</h1>
        <p className="text-sm text-muted-foreground">
          Ripartizione delle voci di spesa {annoSelezionato ? `— anno ${annoSelezionato}` : ""}
        </p>
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
            <SpeseChart spese={speseAnno} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 sm:grid-cols-3">
              {[...speseAnno]
                .sort((a, b) => b.importo - a.importo)
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {CATEGORIE_SPESA_LABEL[s.categoria] ?? s.categoria}
                    </span>
                    <span className="font-medium tabular-nums">{formatEuro(s.importo)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
