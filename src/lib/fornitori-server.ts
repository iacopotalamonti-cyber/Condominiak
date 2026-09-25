import type { SupabaseClient } from "@supabase/supabase-js";

import { chiaveFornitore, indiceFornitori, nomeLeggibile, trovaFornitore } from "./fornitori";
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
    const trovato = trovaFornitore(esistenti, chiave);
    if (trovato) mappa.set(chiave, trovato.id);
    else mancanti.push({ condominium_id: condominiumId, nome });
  }

  if (!mancanti.length) return mappa;

  // Inserimento semplice e non upsert: l'indice che protegge dai doppioni è su
  // lower(nome), un'espressione, e ON CONFLICT vuole colonne. Combinarli faceva
  // fallire ogni inserimento — ed è il motivo per cui l'anagrafica restava
  // vuota mentre i movimenti avevano il nome del fornitore.
  const { data: creati, error } = await supabase.from("fornitori").insert(mancanti).select("*");

  if (!error) {
    for (const fornitore of (creati ?? []) as Fornitore[]) {
      const chiave = chiaveFornitore(fornitore.nome);
      if (chiave) mappa.set(chiave, fornitore.id);
    }
    return mappa;
  }

  // Se qualcuno ha inserito lo stesso fornitore nel frattempo, l'indice unico
  // fa il suo lavoro: si rilegge invece di considerarlo un errore.
  const { data: rilettura } = await supabase
    .from("fornitori")
    .select("*")
    .eq("condominium_id", condominiumId);

  const aggiornato = indiceFornitori((rilettura ?? []) as Fornitore[]);
  for (const chiave of daCreare.keys()) {
    const trovato = trovaFornitore(aggiornato, chiave);
    if (trovato) mappa.set(chiave, trovato.id);
  }

  // L'anagrafica è un miglioramento, non una condizione per salvare le spese:
  // se anche la rilettura non trova nulla, i movimenti si salvano con il solo
  // nome scritto nel documento.
  if (mappa.size < daCreare.size) {
    console.error("Anagrafica fornitori incompleta:", error.message);
  }

  return mappa;
}
