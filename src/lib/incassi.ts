import "server-only";

import type { createClient } from "./supabase/server";
import type { Incasso } from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Le partite di singoli condomini di un condominio.
 *
 * Tollera che la tabella non ci sia: arriva con una migrazione, e fra il
 * rilascio del codice e l'applicazione della migrazione passa del tempo in cui
 * le pagine devono continuare a funzionare. Senza incassi i totali tornano a
 * essere quelli di prima, che è un peggioramento, non un guasto.
 */
export async function incassiDi(supabase: Client, condominiumId: string): Promise<Incasso[]> {
  const { data, error } = await supabase
    .from("incassi")
    .select("*")
    .eq("condominium_id", condominiumId)
    .order("anno", { ascending: false });

  if (error) {
    console.warn("Incassi non leggibili:", error.message);
    return [];
  }

  return (data ?? []) as Incasso[];
}
