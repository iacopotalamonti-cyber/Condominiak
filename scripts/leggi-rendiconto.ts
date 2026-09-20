// Legge un rendiconto e stampa le voci di spesa che ne ricava, senza AI.
//
//   npm run leggi-rendiconto -- percorso/del/rendiconto.pdf
//
// Serve a misurare: quante voci il codice legge da solo, quanto tornano i conti
// rispetto ai totali stampati, e a che costo — zero.

import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";

import {
  leggiVoci,
  quadratura,
  totaliDichiarati,
  totaleVoci,
  type Frammento,
  type Pagina,
  type Riga,
} from "../src/lib/rendiconto.ts";

// Frammenti sulla stessa riga hanno la stessa y a meno di un'inezia: i caratteri
// di una riga non sono allineati al punto.
const TOLLERANZA_RIGA = 2;

async function pagineDi(percorso: string): Promise<Pagina[]> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(percorso)));
  const pagine: Pagina[] = [];

  for (let numero = 1; numero <= pdf.numPages; numero++) {
    const { items } = await (await pdf.getPage(numero)).getTextContent();
    const righe = new Map<number, Riga>();

    for (const item of items as { str?: string; transform: number[]; width?: number }[]) {
      const testo = item.str ?? "";
      if (!testo.trim()) continue;

      const y = Math.round(item.transform[5]);
      const esistente = [...righe.keys()].find((k) => Math.abs(k - y) <= TOLLERANZA_RIGA);
      const chiave = esistente ?? y;
      if (!righe.has(chiave)) righe.set(chiave, { y: chiave, frammenti: [] });

      const x = Math.round(item.transform[4]);
      const frammento: Frammento = { x, xFine: Math.round(x + (item.width ?? 0)), testo };
      righe.get(chiave)!.frammenti.push(frammento);
    }

    pagine.push({ numero, righe: [...righe.values()] });
  }

  return pagine;
}

const percorso = process.argv[2];
if (!percorso) {
  console.error("Uso: npm run leggi-rendiconto -- percorso/del/rendiconto.pdf");
  process.exit(1);
}

const pagine = await pagineDi(percorso);
const { voci, tabelle, pagineLette } = leggiVoci(pagine);

const eur = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log(`${pagine.length} pagine, elenco spese riconosciuto in ${pagineLette.length}: ${pagineLette.join(", ")}\n`);
console.log("codice     proprietario    inquilino  pag  descrizione");

for (const voce of voci) {
  console.log(
    `${voce.codice}  ${eur(voce.totale).padStart(13)}  ${eur(voce.totaleInquilino).padStart(11)}  ` +
      `${String(voce.pagina).padStart(3)}  ${voce.descrizione.slice(0, 44)}`
  );
}

const senzaTotale = voci.filter((v) => v.totale === null && v.totaleInquilino === null);

console.log(`\n${voci.length} voci lette, ${senzaTotale.length} senza totale.`);
console.log(`Somma delle voci: ${eur(totaleVoci(voci))}`);
console.log(`Totali di tabella trovati: ${tabelle.length}`);

const totali = totaliDichiarati(pagine);
const q = quadratura(voci, totali);

console.log("\n--- quadratura ---");
console.log(`voci generali, storni compresi   ${eur(q.generali).padStart(12)}`);
console.log(`spese personali (a contatore)    ${eur(q.personali).padStart(12)}`);
console.log(`ricostruito                      ${eur(q.ricostruito).padStart(12)}`);
console.log(`Totale Gen. stampato             ${eur(totali.generale).padStart(12)}`);
console.log(`scarto                           ${q.scarto === null ? "—" : eur(q.scarto).padStart(12)}`);
