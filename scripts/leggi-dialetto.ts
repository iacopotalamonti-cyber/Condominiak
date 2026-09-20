// Riconosce il formato di un rendiconto e lo legge con il suo dialetto.
//
//   npm run leggi-dialetto -- percorso/del/rendiconto.pdf

import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";

import type { Frammento, Pagina, Riga } from "../src/lib/rendiconto.ts";
import { leggiContavalli, leggiMultigest, riconosciDialetto } from "../src/lib/dialetti.ts";

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
      const frammento: Frammento = { x, xFine: Math.round(x + (item.width ?? 0)), testo: item.str };
      righe.get(chiave)!.frammenti.push(frammento);
    }
    pagine.push({ numero, righe: [...righe.values()] });
  }
  return pagine;
}

const eur = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pagine = await pagineDi(process.argv[2]);
const dialetto = riconosciDialetto(pagine);
console.log(`formato riconosciuto: ${dialetto ?? "NESSUNO — servirebbe il modello"}`);
if (!dialetto || dialetto === "tosiani") process.exit(0);

const lettura = dialetto === "contavalli" ? leggiContavalli(pagine) : leggiMultigest(pagine);
for (const v of lettura.voci) {
  console.log(`  ${eur(v.importo).padStart(12)}  p${String(v.pagina).padStart(2)}  ${v.descrizione.slice(0, 48)}`);
}
console.log(`\n${lettura.voci.length} voci`);
console.log(`somma            ${eur(lettura.voci.reduce((t, v) => t + v.importo, 0)).padStart(12)}`);
console.log(`totale stampato  ${eur(lettura.totaleGenerale).padStart(12)}`);
console.log(`scarto           ${eur(lettura.scarto).padStart(12)}`);
