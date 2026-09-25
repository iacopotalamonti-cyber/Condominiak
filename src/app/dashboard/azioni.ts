"use server";

import { revalidatePath } from "next/cache";

import { eAdmin } from "@/lib/appartenenza";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const ANNO_MIN = 1900;

// Le tabelle che compongono un esercizio, nell'ordine in cui si possono
// cancellare. Il documento caricato NON si cancella: resta in archivio, così
// l'anno si può rileggere senza doverlo ricaricare.
const TABELLE_ESERCIZIO = ["movimenti", "incassi", "quote_unita", "spese", "bilanci"] as const;

/**
 * Toglie un esercizio dall'archivio del condominio.
 *
 * È un'azione server e non una rotta API perché così la pagina si aggiorna da
 * sola: con la rotta, dopo la cancellazione l'esercizio restava a video
 * finché non si ricaricava la pagina a mano.
 */
export async function eliminaEsercizio(
  condominiumId: string,
  anno: number
): Promise<{ success: true } | { success: false; error: string }> {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  if (!Number.isInteger(anno) || anno < ANNO_MIN || anno > new Date().getFullYear() + 1) {
    return { success: false, error: "Anno non valido" };
  }

  // Da qui in poi si usa la service role key, che passa sopra a ogni permesso:
  // il condominio va dimostrato di chi sta cancellando.
  const supabase = createServiceRoleClient();
  if (!(await eAdmin(supabase, user.id, condominiumId))) {
    return { success: false, error: "Non autorizzato" };
  }

  for (const tabella of TABELLE_ESERCIZIO) {
    const { error } = await supabase
      .from(tabella)
      .delete()
      .eq("condominium_id", condominiumId)
      .eq("anno", anno);
    if (error) {
      console.error(`Eliminazione dell'esercizio ${anno} (${tabella}):`, error);
      return { success: false, error: "Eliminazione fallita" };
    }
  }

  // Tutte le pagine del cruscotto mostrano gli esercizi: bilanci, spese,
  // fornitori, appartamento. Si aggiornano tutte, non solo quella aperta.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
