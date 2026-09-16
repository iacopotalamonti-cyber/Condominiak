import type { SupabaseClient } from "@supabase/supabase-js";

import { chiaveFornitore, indiceFornitori, nomeLeggibile } from "./fornitori";
import type { Fornitore } from "./types";

// Trasforma i nomi letti nei documenti in righe di anagrafica: quelli già noti
// vengono riconosciuti (anche scritti diversamente, grazie agli alias), quelli
// nuovi vengono creati una volta sola.
//
// Restituisce la mappa chiave-di-riconoscimento -> id, che chi salva usa per
// collegare ogni movimento senza rifare la ricerca riga per riga.
export async function risolviFornitori(
  supabase: SupabaseClient,
  condominiumId: string,
  nomi: (string | null | undefined)[]
): Promise<Map<string, string>> {
  // Si conserva la prima scrittura incontrata per ciascuna chiave: è quella che
  // diventa il nome della scheda, e ha almeno il pregio di venire dal documento.
  const daCreare = new Map<string, string>();
  for (const nome of nomi) {
    const chiave = chiaveFornitore(nome);
    const leggibile = nomeLeggibile(nome);
    if (!chiave || !leggibile) continue;
    if (!daCreare.has(chiave)) daCreare.set(chiave, leggibile);
  }

  const mappa = new Map<string, string>();
  if (!daCreare.size) return mappa;

  const { data } = await supabase
    .from("fornitori")
    .select("*")
    .eq("condominium_id", condominiumId);

  const esistenti = indiceFornitori((data ?? []) as Fornitore[]);
  const mancanti: { condominium_id: string; nome: string }[] = [];

  for (const [chiave, nome] of daCreare) {
    const trovato = esistenti.get(chiave);
    if (trovato) mappa.set(chiave, trovato.id);
    else mancanti.push({ condominium_id: condominiumId, nome });
  }

  if (!mancanti.length) return mappa;

  // Due documenti caricati insieme possono nominare lo stesso fornitore nuovo:
  // l'indice unico su (condominio, nome) impedisce il doppione, e onConflict
  // fa sì che il secondo inserimento lo ritrovi invece di fallire.
  const { data: creati, error } = await supabase
    .from("fornitori")
    .upsert(mancanti, { onConflict: "condominium_id,nome", ignoreDuplicates: false })
    .select("*");

  if (error) {
    // L'anagrafica è un miglioramento, non una condizione per salvare le spese:
    // se fallisce, i movimenti si salvano comunque con il solo nome scritto.
    console.error("Anagrafica fornitori non aggiornata:", error.message);
    return mappa;
  }

  for (const fornitore of (creati ?? []) as Fornitore[]) {
    for (const chiave of [chiaveFornitore(fornitore.nome)]) {
      if (chiave) mappa.set(chiave, fornitore.id);
    }
  }

  return mappa;
}
