import type { Config } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sistema, type Dati, type Esito } from "../../src/lib/manutenzione";
import { BUCKET, CARTELLA_DOCUMENTI, CARTELLA_TEMPORANEA } from "../../src/lib/percorsi";

// Ogni ora rimette al suo posto i file rimasti fuori dalle cartelle dei
// condomini (vedi src/lib/manutenzione.ts). Gira solo sul sito pubblicato.
export const config: Config = { schedule: "@hourly" };

// Una funzione pianificata ha 30 secondi: ci si ferma prima, e quello che
// resta si fa all'ora successiva. Ogni passo è completo in sé.
const BUDGET_MS = 22_000;

// Le colonne che puntano a un file del bucket.
const CITAZIONI: [tabella: string, colonna: string][] = [
  ["bilanci", "documento_path"],
  ["spese", "documento_path"],
  ["movimenti", "documento_path"],
  ["incassi", "documento_path"],
  ["quote_unita", "documento_path"],
  ["documenti", "storage_path"],
];

function datiDa(supabase: SupabaseClient): Dati {
  return {
    async condominiCheCitano(path) {
      const trovati: string[] = [];
      for (const [tabella, colonna] of CITAZIONI) {
        const { data, error } = await supabase
          .from(tabella)
          .select("condominium_id")
          .eq(colonna, path)
          .limit(50);
        if (error) throw new Error(`${tabella}: ${error.message}`);
        trovati.push(...(data ?? []).map((r) => r.condominium_id as string));
      }
      return trovati;
    },
    async condominiAmministrati(utente) {
      const { data, error } = await supabase
        .from("membri")
        .select("condominium_id")
        .eq("user_id", utente)
        .eq("ruolo", "admin");
      if (error) throw new Error(`membri: ${error.message}`);
      return (data ?? []).map((r) => r.condominium_id as string);
    },
    async sostituisci(da, a) {
      for (const [tabella, colonna] of CITAZIONI) {
        const { error } = await supabase.from(tabella).update({ [colonna]: a }).eq(colonna, da);
        if (error) throw new Error(`${tabella}: ${error.message}`);
      }
    },
  };
}

async function fileSotto(supabase: SupabaseClient, radice: string) {
  const bucket = supabase.storage.from(BUCKET);
  const file: { path: string; creato: string | null; byte: number }[] = [];
  const { data: cartelle, error } = await bucket.list(radice, { limit: 1000 });
  if (error) throw new Error(`Elenco di ${radice} fallito: ${error.message}`);
  for (const cartella of cartelle ?? []) {
    if (cartella.id) continue;
    const { data, error: e } = await bucket.list(`${radice}/${cartella.name}`, {
      limit: 1000,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (e) throw new Error(`Elenco di ${radice}/${cartella.name} fallito: ${e.message}`);
    for (const o of data ?? []) {
      if (!o.id) continue;
      file.push({
        path: `${radice}/${cartella.name}/${o.name}`,
        creato: o.created_at ?? null,
        byte: Number(o.metadata?.size ?? 0),
      });
    }
  }
  return file;
}

export default async () => {
  const url = Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const chiave = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chiave) {
    console.error("manutenzione-storage: mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const supabase = createClient(url, chiave, { auth: { autoRefreshToken: false, persistSession: false } });
  const bucket = supabase.storage.from(BUCKET);
  const dati = datiDa(supabase);
  const fine = Date.now() + BUDGET_MS;
  const adesso = new Date();

  // Prima lo storico, che è quello che i link aprono.
  const daSistemare = [
    ...(await fileSotto(supabase, CARTELLA_DOCUMENTI)),
    ...(await fileSotto(supabase, CARTELLA_TEMPORANEA)),
  ];

  const conteggio = new Map<string, number>();
  let liberati = 0;
  let rimasti = 0;
  for (const file of daSistemare) {
    if (Date.now() > fine) {
      rimasti++;
      continue;
    }
    let esito: Esito;
    try {
      esito = await sistema(bucket, dati, file, adesso);
    } catch (error) {
      console.error(`manutenzione-storage: ${file.path}:`, error);
      esito = { azione: "lasciato", motivo: "errore" };
    }
    const chiave = esito.azione === "lasciato" ? `lasciato (${esito.motivo})` : esito.azione;
    conteggio.set(chiave, (conteggio.get(chiave) ?? 0) + 1);
    if (esito.azione === "doppione rimosso") liberati += file.byte;
    if (esito.azione !== "lasciato") console.log(`manutenzione-storage: ${file.path} → ${JSON.stringify(esito)}`);
  }

  console.log(
    `manutenzione-storage: ${daSistemare.length} file fuori dai condomini; ` +
      [...conteggio].map(([k, n]) => `${k}: ${n}`).join(", ") +
      (liberati ? `; liberati ${(liberati / 1_048_576).toFixed(1)} MB` : "") +
      (rimasti ? `; ${rimasti} rimandati all'ora successiva` : "")
  );
};
