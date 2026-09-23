import { AlertTriangle, Building2, TrendingUp, Users, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { incassiDi } from "@/lib/incassi";
import { getDashboardContext } from "@/lib/dashboard-context";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertBar, type AlertItem } from "@/components/dashboard/AlertBar";
import { PaymentGrid } from "@/components/dashboard/PaymentGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcolaMorosita,
  formatEuro,
  percentualeMorosita,
  scoreEdificio,
} from "@/lib/calcoli";
import { esercizioCorrente } from "@/lib/bilancio";
import type { Bilancio, Impianto, Pagamento, Spesa, Unita } from "@/lib/types";

export default async function DashboardPage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();
  const annoCorrente = new Date().getFullYear();

  const [{ data: unita }, { data: pagamenti }, { data: impianti }, { data: bilanci }, { data: spese }] =
    await Promise.all([
      supabase
        .from("unita")
        .select("*")
        .eq("condominium_id", condominium.id)
        .eq("tipologia", "appartamento")
        .order("interno"),
      supabase.from("pagamenti").select("*").eq("condominium_id", condominium.id).eq("anno", annoCorrente),
      supabase.from("impianti").select("*").eq("condominium_id", condominium.id),
      supabase.from("bilanci").select("*").eq("condominium_id", condominium.id),
      supabase.from("spese").select("*").eq("condominium_id", condominium.id),
    ]);

  const unitaList = (unita ?? []) as Unita[];
  const pagamentiList = (pagamenti ?? []) as Pagamento[];
  const impiantiList = (impianti ?? []) as Impianto[];

  // Lo stesso totale che mostrano Analisi spese e Bilanci 5 anni. Prima questa
  // scheda prendeva il consuntivo del bilancio più recente e lo chiamava "anno
  // corrente" anche quando l'anno era un altro.
  const esercizio = esercizioCorrente(
    (bilanci ?? []) as Bilancio[],
    (spese ?? []) as Spesa[],
    annoCorrente,
    await incassiDi(supabase, condominium.id)
  );

  const morosita = calcolaMorosita(pagamentiList);
  const morositaPct = percentualeMorosita(pagamentiList);
  const salute = scoreEdificio(impiantiList, morositaPct);

  const alerts: AlertItem[] = [];
  if (morosita > 0) {
    alerts.push({
      id: "morosita",
      severity: morositaPct > 15 ? "critical" : "warning",
      message: `Morosità rilevata: ${formatEuro(morosita)} non ancora incassati (${morositaPct.toFixed(1)}%)`,
    });
  }
  const impiantiCritici = impiantiList.filter((i) => i.stato === "critical");
  if (impiantiCritici.length) {
    alerts.push({
      id: "impianti-critici",
      severity: "critical",
      message: `${impiantiCritici.length} impianto/i in stato critico da verificare`,
    });
  }
  const scadenzeVicine = impiantiList.filter((i) => i.scadenza_contratto);
  if (scadenzeVicine.length) {
    alerts.push({
      id: "scadenze",
      severity: "info",
      message: `Contratti con scadenza registrata: ${scadenzeVicine
        .map((i) => i.scadenza_contratto)
        .join(", ")}`,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Panoramica generale di {condominium.via}, {condominium.citta}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Unità immobiliari" value={String(unitaList.length)} icon={Users} />
        <KPICard
          label={esercizio ? `Spesa esercizio ${esercizio.anno}` : "Spesa esercizio"}
          value={formatEuro(esercizio?.totale)}
          hint={
            esercizio?.nonClassificato
              ? `${formatEuro(esercizio.nonClassificato)} ancora da classificare`
              : undefined
          }
          icon={Wallet}
          tone={esercizio?.nonClassificato ? "warning" : undefined}
        />
        <KPICard
          label="Morosità"
          value={formatEuro(morosita)}
          hint={`${morositaPct.toFixed(1)}% del totale atteso`}
          icon={AlertTriangle}
          tone={morosita > 0 ? "warning" : "success"}
        />
        <KPICard
          label="Salute edificio"
          value={`${salute}/100`}
          icon={TrendingUp}
          tone={salute >= 80 ? "success" : salute >= 50 ? "warning" : "destructive"}
        />
      </div>

      <AlertBar alerts={alerts} />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-muted-foreground" />
            Pagamenti {annoCorrente}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unitaList.length ? (
            <PaymentGrid unita={unitaList} pagamenti={pagamentiList} />
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna unità registrata.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
