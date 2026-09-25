import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Le migrazioni sono schema: girano su ogni database, anche su uno nuovo o su
// staging. I numeri di un condominio stanno in supabase/dati, ciascun file
// ancorato al proprio condominio per id.

const RADICE = join(import.meta.dirname, "..", "..", "..", "supabase");
const sql = (cartella: string) =>
  readdirSync(join(RADICE, cartella))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ nome: f, testo: readFileSync(join(RADICE, cartella, f), "utf8") }));

const TABELLE_DI_DATI = /insert\s+into\s+public\.(condominiums|unita|bilanci|spese|movimenti|incassi|quote_unita|pagamenti|documenti)\b/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test("nessuna migrazione, e nessun ritorno indietro, sceglie un condominio a caso", () => {
  for (const { nome, testo } of [...sql("migrations"), ...sql("rollback")]) {
    assert.doesNotMatch(testo.replace(/--.*$/gm, ""), /condominiums\s+limit\s+1/i, nome);
  }
});

test("nessuna migrazione scrive i dati di un condominio", () => {
  for (const { nome, testo } of sql("migrations")) {
    assert.doesNotMatch(testo, TABELLE_DI_DATI, `${nome}: i dati vanno in supabase/dati`);
    assert.doesNotMatch(testo, UUID, `${nome}: un id nominato è il dato di qualcuno`);
  }
});

test("ogni file di dati si ferma se il suo condominio non c'è", () => {
  const dati = sql("dati");
  assert.ok(dati.length > 0);
  for (const { nome, testo } of dati) {
    assert.doesNotMatch(testo.replace(/^--.*$/gm, ""), /limit\s+1/i, nome);
    const guardia = testo.match(/if not exists \(select 1 from public\.condominiums where id = '([0-9a-f-]{36})'\)/);
    assert.ok(guardia, `${nome}: manca il controllo sul condominio`);
    // Ogni id di condominio citato è quello della guardia.
    const citati = new Set(
      [...testo.matchAll(/condominium_id = '([0-9a-f-]{36})'|'([0-9a-f-]{36})'::uuid|where id = '([0-9a-f-]{36})'/g)].map(
        (m) => m[1] ?? m[2] ?? m[3]
      )
    );
    assert.deepEqual([...citati], [guardia[1]], nome);
  }
});
