// Riconosce il formato di un rendiconto e lo legge con il motore.
//
//   npm run leggi-bilancio -- percorso/del/rendiconto.pdf

import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";

import { leggi, riconosci } from "../src/lib/motore.ts";
import { PROFILI } from "../src/lib/profili.ts";
import { classifica, mappaturaPer } from "../src/lib/profilo.ts";
import type { Frammento, Pagina, Riga } from "../src/lib/rendiconto.ts";

async function pagineDi(percorso: string): Promise<Pagina[]> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(percorso)));
  const pagine: Pagina[] = [];
  for (let numero = 1; numero <= pdf.numPages; numero++) {
    const { items } = await (await pdf.getPage(numero)).getTextContent();
    const righe = new Map<number, Riga>();
    for (const item of items as { str?: string; transform: number[]; width?: number }[]) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const chiave = [...righe.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!righe.has(chiave)) righe.set(chiave, { y: chiave, frammenti: [] });
      const x = Math.round(item.transform[4]);
      const f: Frammento = { x, xFine: Math.round(x + (item.width ?? 0)), testo: item.str };
      righe.get(chiave)!.frammenti.push(f);
    }
    pagine.push({ numero, righe: [...righe.values()] });
  }
  return pagine;
}

const eur = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pagine = await pagineDi(process.argv[2]);
const profilo = riconosci(pagine, PROFILI);

if (!profilo) {
  console.log("formato sconosciuto — qui servirebbe il modello");
  process.exit(0);
}

const lettura = leggi(pagine, profilo);
console.log(`formato: ${lettura.profilo}\n`);
for (const v of lettura.voci) {
  const secondo = v.importoSecondario === null ? "" : `  +${eur(v.importoSecondario)}`;
  console.log(`  [${v.chiave}] ${eur(v.importo).padStart(11)}${secondo.padEnd(12)}  p${String(v.pagina).padStart(2)}  ${v.descrizione.slice(0, 38)}`);
}
for (const p of lettura.personali) {
  console.log(`  ${eur(p.importo).padStart(12)}${"".padEnd(14)}  a contatore  ${p.descrizione.slice(0, 34)}`);
}
console.log(`\n${lettura.voci.length} voci, ${lettura.personali.length} a contatore`);
console.log(`totale stampato  ${eur(lettura.totaleGenerale).padStart(12)}`);
console.log(`scarto           ${eur(lettura.scarto).padStart(12)}`);

const mappatura = mappaturaPer(profilo.nome);
if (mappatura) {
  const c = classifica(lettura, mappatura);
  console.log("\n--- categorie ---");
  for (const [categoria, importo] of Object.entries(c.spese).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
    console.log(`${categoria.padEnd(16)} ${eur(importo ?? 0).padStart(12)}`);
  }
  console.log(`${"TOTALE SPESE".padEnd(16)} ${eur(c.totaleSpese).padStart(12)}`);
  for (const r of c.rimborsi) console.log(`a parte          ${eur(r.importo).padStart(12)}  ${r.descrizione.slice(0, 36)}`);
  for (const n of c.nonMappate) console.log(`NON MAPPATO      ${eur(n.importo).padStart(12)}  ${n.codice} ${n.descrizione.slice(0, 30)}`);
}
