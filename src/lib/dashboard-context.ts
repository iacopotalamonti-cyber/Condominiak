import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Condominium, Unita } from "@/lib/types";

export interface DashboardContext {
  userId: string;
  role: "admin" | "resident";
  condominium: Condominium;
  unita: Unita | null; // valorizzato solo per il resident
}

// Recupera contesto condominio+ruolo per l'utente corrente. Da chiamare in
// ogni Server Component sotto /dashboard: il middleware garantisce già che
// l'utente sia autenticato e abbia un condominio/unità associati.
export async function getDashboardContext(): Promise<DashboardContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: ownedCondominium } = await supabase
    .from("condominiums")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownedCondominium) {
    return { userId: user.id, role: "admin", condominium: ownedCondominium, unita: null };
  }

  const { data: unita } = await supabase
    .from("unita")
    .select("*, condominiums(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (unita && unita.condominiums) {
    const { condominiums, ...unitaRest } = unita as Unita & { condominiums: Condominium };
    return { userId: user.id, role: "resident", condominium: condominiums, unita: unitaRest };
  }

  redirect("/onboarding");
}
