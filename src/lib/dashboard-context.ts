import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_CONDOMINIO,
  appartenenzeDi,
  condominioAttivo,
  unitaDi,
  type Appartenenza,
} from "@/lib/appartenenza";
import type { Condominium, Role, Unita } from "@/lib/types";

export interface DashboardContext {
  userId: string;
  /** Il ruolo nel condominio che l'utente sta guardando. */
  role: Role;
  condominium: Condominium;
  /** Tutti i condomini dell'utente, per poter passare dall'uno all'altro. */
  condomini: Appartenenza[];
  /** Le unità dell'utente nel condominio attivo: appartamento, box, cantina. */
  unita: Unita[];
}

// Recupera contesto condominio e ruolo per l'utente corrente. Da chiamare in
// ogni Server Component sotto /dashboard.
//
// Prima leggeva il condominio e l'unità dell'utente aspettandosene una riga
// ciascuno: chi aveva due appartamenti, o un appartamento e un box, veniva
// rimandato all'onboarding. Ora un utente può appartenere a più condomini e
// avere più unità in ciascuno.
export async function getDashboardContext(): Promise<DashboardContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const condomini = await appartenenzeDi(supabase, user.id);
  const scelto = (await cookies()).get(COOKIE_CONDOMINIO)?.value;
  const attivo = condominioAttivo(condomini, scelto);

  if (!attivo) redirect("/onboarding");

  return {
    userId: user.id,
    role: attivo.ruolo,
    condominium: attivo.condominium,
    condomini,
    unita: await unitaDi(supabase, user.id, attivo.condominium.id),
  };
}
