import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { ImpiantiGrid } from "@/components/dashboard/ImpiantiGrid";
import type { Impianto } from "@/lib/types";

export default async function ImpiantiPage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("impianti")
    .select("*")
    .eq("condominium_id", condominium.id)
    .order("tipo");

  const impianti = (data ?? []) as Impianto[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Impianti e servizi</h1>
        <p className="text-sm text-muted-foreground">
          Stato, contratti e scadenze degli impianti del condominio
        </p>
      </div>

      <ImpiantiGrid impianti={impianti} />
    </div>
  );
}
