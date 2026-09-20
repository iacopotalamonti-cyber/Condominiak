// Rimuove dal bucket i file duplicati, tenendo quelli a cui puntano i dati.
//
//   node --env-file=.env.local scripts/pulisci-storage.mjs            # elenco, non cancella
//   node --env-file=.env.local scripts/pulisci-storage.mjs --esegui   # cancella davvero
//
// L'identità di un documento è l'impronta del suo contenuto, non il nome: due
// file con lo stesso nome possono essere documenti diversi, e lo stesso
// documento arriva con nomi diversi. Un file il cui contenuto non esiste da
// nessun'altra parte non viene mai toccato, qualunque nome abbia e ovunque si
// trovi: la peggiore cosa che questo script può fare è non cancellare
// abbastanza.
//
// Fra le copie di uno stesso contenuto resta quella citata da un bilancio, da
// una spesa, da un movimento o dall'archivio documenti: sono i percorsi che
// l'interfaccia apre quando mostri da dove viene un importo. Se nessuna copia
// è citata resta la più vecchia, che è quella con più probabilità di essere
// già finita in un link.

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "documenti-condominiali";
const esegui = process.argv.includes("--esegui");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Lancia con: node --env-file=.env.local scripts/pulisci-storage.mjs");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// --- tutti gli oggetti del bucket, cartella per cartella -------------------

async function elenca(prefisso = "") {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefisso, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`Elenco di "${prefisso}" fallito: ${error.message}`);

  const oggetti = [];
  for (const voce of data ?? []) {
    const percorso = prefisso ? `${prefisso}/${voce.name}` : voce.name;
    // Senza id è un segnaposto di cartella, e va percorso a sua volta.
    if (voce.id) oggetti.push({ percorso, creato: voce.created_at });
    else oggetti.push(...(await elenca(percorso)));
  }
  return oggetti;
}

// --- i percorsi che i dati citano -----------------------------------------

async function percorsiCitati() {
  const citati = new Set();
  const fonti = [
    ["bilanci", "documento_path"],
    ["spese", "documento_path"],
    ["movimenti", "documento_path"],
    ["documenti", "storage_path"],
  ];

  for (const [tabella, colonna] of fonti) {
    const { data, error } = await supabase.from(tabella).select(colonna);
    if (error) throw new Error(`Lettura di ${tabella} fallita: ${error.message}`);
    for (const riga of data ?? []) if (riga[colonna]) citati.add(riga[colonna]);
  }
  return citati;
}

// --- impronta del contenuto ------------------------------------------------

async function impronta(percorso) {
  const { data, error } = await supabase.storage.from(BUCKET).download(percorso);
  if (error) throw new Error(`Lettura di "${percorso}" fallita: ${error.message}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { hash: createHash("sha256").update(bytes).digest("hex"), byte: bytes.length };
}

// --- programma -------------------------------------------------------------

const oggetti = await elenca();
const citati = await percorsiCitati();
console.log(`${oggetti.length} file nel bucket, ${citati.size} citati dai dati.\n`);

const gruppi = new Map();
for (const oggetto of oggetti) {
  const { hash, byte } = await impronta(oggetto.percorso);
  if (!gruppi.has(hash)) gruppi.set(hash, { byte, copie: [] });
  gruppi.get(hash).copie.push(oggetto);
}

const daCancellare = [];
let recuperabili = 0;

for (const [hash, { byte, copie }] of gruppi) {
  if (copie.length === 1) continue;

  copie.sort((a, b) => new Date(a.creato) - new Date(b.creato));
  const tenuta = copie.find((c) => citati.has(c.percorso)) ?? copie[0];

  console.log(`${hash.slice(0, 12)}  ${copie.length} copie  ${(byte / 1024).toFixed(0)} KB`);
  console.log(`   tengo     ${tenuta.percorso}${citati.has(tenuta.percorso) ? "   (citato dai dati)" : ""}`);
  for (const copia of copie) {
    if (copia === tenuta) continue;
    if (citati.has(copia.percorso)) {
      // Non può succedere se i dati sono coerenti, ma se succedesse
      // cancellare romperebbe un link: meglio fermarsi e dirlo.
      console.log(`   ATTENZIONE anche questa è citata, la lascio: ${copia.percorso}`);
      continue;
    }
    console.log(`   cancello  ${copia.percorso}`);
    daCancellare.push(copia.percorso);
    recuperabili += byte;
  }
  console.log();
}

if (!daCancellare.length) {
  console.log("Nessun duplicato da rimuovere.");
  process.exit(0);
}

console.log(`${daCancellare.length} file da cancellare, ${(recuperabili / 1024 / 1024).toFixed(1)} MB recuperati.`);

if (!esegui) {
  console.log("\nNiente è stato cancellato. Rilancia con --esegui per procedere.");
  process.exit(0);
}

const { error } = await supabase.storage.from(BUCKET).remove(daCancellare);
if (error) {
  console.error("Cancellazione fallita:", error.message);
  process.exit(1);
}
console.log("Fatto.");
