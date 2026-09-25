// A quali condomini appartiene un utente, e in quale sta guardando.
//
// Prima l'appartenenza si deduceva da due colonne — il condominio di cui un
// utente era "owner", o l'unità a cui era collegato — lette aspettandosene una
// riga sola: con due, l'utente veniva rimandato all'onboarding. Ora sta nella
// tabella membri, e un utente può averne quante vuole. Quello che guarda è il
// "condominio attivo", scelto con un cookie; se il cookie manca o nomina un
// condominio che non è più suo, si torna al primo.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Condominium, Role, Unita } from "./types";

export const COOKIE_CONDOMINIO = "condominio";

export interface Appartenenza {
  condominium: Condominium;
  ruolo: Role;
}

interface RigaMembro {
  ruolo: Role;
  created_at: string;
  condominiums: Condominium | Condominium[] | null;
}

/** I condomini dell'utente, dal più vecchio: il primo è quello di default. */
export async function appartenenzeDi(
  supabase: SupabaseClient,
  userId: string
): Promise<Appartenenza[]> {
  const { data, error } = await supabase
    .from("membri")
    .select("ruolo, created_at, condominiums(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as RigaMembro[])
    .map((riga) => ({
      // La relazione arriva come oggetto, ma il tipo generato la ammette
      // anche come array: si gestiscono entrambe le forme.
      condominium: Array.isArray(riga.condominiums) ? riga.condominiums[0] : riga.condominiums,
      ruolo: riga.ruolo,
    }))
    .filter((a): a is Appartenenza => Boolean(a.condominium));
}

/**
 * Il condominio che l'utente sta guardando.
 *
 * Il cookie è solo una preferenza: se nomina un condominio a cui l'utente non
 * appartiene — perché è stato tolto, o perché qualcuno l'ha scritto a mano —
 * non vale niente, e si torna al primo.
 */
export function condominioAttivo(
  appartenenze: Appartenenza[],
  scelto: string | undefined
): Appartenenza | null {
  return appartenenze.find((a) => a.condominium.id === scelto) ?? appartenenze[0] ?? null;
}

/** Le unità dell'utente in un condominio: appartamento, box, cantina. */
export async function unitaDi(
  supabase: SupabaseClient,
  userId: string,
  condominiumId: string
): Promise<Unita[]> {
  const { data, error } = await supabase
    .from("unita_membri")
    .select("unita(*)")
    .eq("user_id", userId);

  if (error) throw error;

  return ((data ?? []) as { unita: Unita | Unita[] | null }[])
    .map((riga) => (Array.isArray(riga.unita) ? riga.unita[0] : riga.unita))
    .filter((u): u is Unita => Boolean(u) && u!.condominium_id === condominiumId)
    .sort((a, b) => (a.codice ?? "").localeCompare(b.codice ?? ""));
}

/**
 * Se l'utente gestisce quel condominio.
 *
 * Da usare nelle route che scrivono con la chiave di servizio: quella chiave
 * passa sopra la RLS, quindi il controllo che la RLS farebbe va fatto qui, e
 * sempre sul condominio che la richiesta nomina, mai su quello del cookie.
 */
export async function eAdmin(
  supabase: SupabaseClient,
  userId: string,
  condominiumId: string
): Promise<boolean> {
  if (!condominiumId) return false;

  const { data } = await supabase
    .from("membri")
    .select("ruolo")
    .eq("user_id", userId)
    .eq("condominium_id", condominiumId)
    .maybeSingle();

  return data?.ruolo === "admin";
}

/** Gli id dei condomini dell'utente: tutti, e quelli che amministra. */
export async function condominiDi(
  supabase: SupabaseClient,
  userId: string
): Promise<{ membro: string[]; admin: string[] }> {
  const { data, error } = await supabase
    .from("membri")
    .select("condominium_id, ruolo")
    .eq("user_id", userId);

  if (error) throw error;

  const righe = (data ?? []) as { condominium_id: string; ruolo: Role }[];
  return {
    membro: righe.map((r) => r.condominium_id),
    admin: righe.filter((r) => r.ruolo === "admin").map((r) => r.condominium_id),
  };
}
