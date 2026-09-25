// La prova del giro completo dei consuntivi, senza toccare il database.
//
//   npm run confronta-consuntivi -- foto.json rendiconto1.pdf rendiconto2.pdf …
//
// Per ogni PDF fa ciò che fa l'app quando un amministratore cancella un
// esercizio e lo ricarica: legge il documento (lettura.ts), lo traduce nella
// forma che il client manda al server (estrazioneDa), e costruisce le righe
// che il server scriverebbe (salvataggio.ts, la stessa funzione della rotta).
// Poi confronta quelle righe, voce per voce, con la fotografia del database.
//
// La fotografia è un JSON con i numeri di oggi (vedi `Foto` qui sotto). Non
// sta nel repository: contiene i dati di un condominio vero.
//
// Un documento che il motore non sa leggere da solo andrebbe al modello, e
// il modello non dà due volte la stessa risposta: lo script lo dice invece di
// confrontarlo, perché lì il confronto non proverebbe niente.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { estrazioneDa, leggiRendiconto, pagineDi } from "../src/lib/lettura.ts";
import { righeBilancio } from "../src/lib/salvataggio.ts";

interface Foto {
  bilanci: { anno: number; prev: number | null; cons: number | null; fondo: number | null; totale: number | null }[];
  /** [anno, categoria, importo] */
  spese: [number, string, number][];
  /** [anno, descrizione, importo] */
  incassi: [number, string, number][];
  /** [anno, codice unità, totale, numero di colonne] */
  quote: [number, string, number, number][];
  /** [anno, categoria, quante righe, somma] */
  movimenti: [number, string, number, number][];
}

const eur = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uguali = (a: number | null | undefined, b: number | null | undefined) =>
  Math.abs((a ?? 0) - (b ?? 0)) < 0.005;

const [percorsoFoto, ...pdf] = process.argv.slice(2);
if (!percorsoFoto || !pdf.length) {
  console.error("Uso: npm run confronta-consuntivi -- foto.json rendiconto.pdf …");
  process.exit(2);
}
const foto = JSON.parse(await readFile(percorsoFoto, "utf8")) as Foto;

let differenze = 0;
const anniVisti = new Set<number>();

function riga(ok: boolean, testo: string) {
  if (!ok) differenze++;
  console.log(`  ${ok ? "✓" : "✗"} ${testo}`);
}

for (const percorso of pdf) {
  const nome = basename(percorso).replace(/^[0-9a-f]{8}-/, "");
  console.log(`\n=== ${nome}`);

  const pagine = await pagineDi(new Uint8Array(await readFile(percorso)));
  const letto = leggiRendiconto(pagine);
  if (!letto) {
    console.log("  ! formato sconosciuto: l'app lo manderebbe al modello, non si confronta");
    continue;
  }
  if (letto.motivo) {
    console.log(`  ! ${letto.formato}, lettura non utilizzabile (${letto.motivo}): andrebbe al modello`);
    continue;
  }

  const estratto = estrazioneDa(letto, nome);
  const anno = estratto.anno;
  console.log(`  formato ${letto.formato}, esercizio ${anno}`);
  if (anniVisti.has(anno)) {
    console.log(`  (esercizio ${anno} già confrontato con un altro file: stesso confronto)`);
  }
  anniVisti.add(anno);

  const righe = righeBilancio(
    {
      anno,
      prev: estratto.prev,
      cons: estratto.cons,
      fondo: estratto.fondo,
      totale: estratto.totale,
      spese: estratto.spese as unknown as Record<string, number>,
      fonti: estratto.fonti,
      movimenti: estratto.movimenti ?? [],
      incassi: estratto.incassi ?? [],
      quote: estratto.quote ?? [],
    },
    "condominio",
    "documento"
  );

  // --- l'esercizio ----------------------------------------------------------
  const oggi = foto.bilanci.find((b) => b.anno === anno);
  if (!oggi) {
    riga(false, `l'esercizio ${anno} oggi non c'è: il ricaricamento lo aggiungerebbe`);
  } else {
    const b = righe.bilancio;
    for (const [campo, nuovo, vecchio] of [
      ["consuntivo", b?.consuntivo, oggi.cons],
      ["totale stampato", b?.totale_documento, oggi.totale],
      ["preventivo", b?.preventivo, oggi.prev],
      ["fondo di riserva", b?.fondo_riserva, oggi.fondo],
    ] as const) {
      riga(uguali(nuovo, vecchio), `${campo}: oggi ${eur(vecchio)}, ricaricato ${eur(nuovo)}`);
    }
  }

  // --- le spese per categoria ----------------------------------------------
  const speseOggi = new Map(foto.spese.filter(([a]) => a === anno).map(([, c, v]) => [c, v]));
  const speseNuove = new Map(righe.spese.map((s) => [s.categoria, s.importo]));
  const categorie = [...new Set([...speseOggi.keys(), ...speseNuove.keys()])].sort();
  const speseDiverse = categorie.filter((c) => !uguali(speseOggi.get(c), speseNuove.get(c)));
  riga(!speseDiverse.length, `spese: ${categorie.length} categorie, ${speseDiverse.length} diverse`);
  for (const c of speseDiverse) {
    console.log(`      ${c}: oggi ${eur(speseOggi.get(c))}, ricaricato ${eur(speseNuove.get(c))}`);
  }

  // --- gli incassi -----------------------------------------------------------
  const incassiOggi = foto.incassi.filter(([a]) => a === anno);
  const incassiNuovi = righe.incassi;
  const incassiUguali =
    incassiOggi.length === incassiNuovi.length &&
    incassiOggi.every(([, d, v]) => incassiNuovi.some((n) => n.descrizione === d && uguali(n.importo, v)));
  riga(incassiUguali, `incassi: oggi ${incassiOggi.length}, ricaricati ${incassiNuovi.length}`);
  if (!incassiUguali) {
    for (const [, d, v] of incassiOggi) console.log(`      oggi:       ${d} ${eur(v)}`);
    for (const n of incassiNuovi) console.log(`      ricaricato: ${n.descrizione} ${eur(n.importo)}`);
  }

  // --- le quote per unità ----------------------------------------------------
  const quoteOggi = new Map(foto.quote.filter(([a]) => a === anno).map(([, c, t, n]) => [c, { t, n }]));
  const quoteNuove = new Map(righe.quote.map((q) => [q.codice, { t: q.totale, n: Object.keys(q.importi).length }]));
  if (quoteOggi.size || quoteNuove.size) {
    const codici = [...new Set([...quoteOggi.keys(), ...quoteNuove.keys()])].sort();
    const quoteDiverse = codici.filter((c) => {
      const o = quoteOggi.get(c);
      const n = quoteNuove.get(c);
      return !o || !n || !uguali(o.t, n.t) || o.n !== n.n;
    });
    riga(
      !quoteDiverse.length,
      `quote: oggi ${quoteOggi.size} unità, ricaricate ${quoteNuove.size}, ${quoteDiverse.length} diverse`
    );
    for (const c of quoteDiverse.slice(0, 10)) {
      const o = quoteOggi.get(c);
      const n = quoteNuove.get(c);
      console.log(`      ${c}: oggi ${o ? `${eur(o.t)} su ${o.n} colonne` : "—"}, ricaricata ${n ? `${eur(n.t)} su ${n.n} colonne` : "—"}`);
    }
  } else {
    console.log("  · quote: né oggi né nel documento (il riparto di questo formato non si legge ancora)");
  }

  // --- i movimenti -------------------------------------------------------------
  const movOggi = foto.movimenti.filter(([a]) => a === anno);
  const movNuovi = new Map<string, { n: number; s: number }>();
  for (const m of righe.movimenti) {
    const v = movNuovi.get(m.categoria) ?? { n: 0, s: 0 };
    movNuovi.set(m.categoria, { n: v.n + 1, s: Math.round((v.s + m.importo) * 100) / 100 });
  }
  const totNuovi = [...movNuovi.values()].reduce((t, v) => t + v.n, 0);
  if (!movOggi.length) {
    console.log(`  · movimenti: oggi nessuno, il ricaricamento ne aggiungerebbe ${totNuovi}`);
  } else {
    const diversi = movOggi.filter(([, c, n, s]) => {
      const v = movNuovi.get(c);
      return !v || v.n !== n || !uguali(v.s, s);
    });
    const extra = [...movNuovi.keys()].filter((c) => !movOggi.some(([, k]) => k === c));
    riga(
      !diversi.length && !extra.length,
      `movimenti: oggi ${movOggi.reduce((t, [, , n]) => t + n, 0)} righe, ricaricati ${totNuovi}`
    );
    for (const [, c, n, s] of diversi) {
      const v = movNuovi.get(c);
      console.log(`      ${c}: oggi ${n} righe per ${eur(s)}, ricaricati ${v?.n ?? 0} per ${eur(v?.s ?? 0)}`);
    }
  }
}

const mancanti = foto.bilanci.filter((b) => !anniVisti.has(b.anno)).map((b) => b.anno);
if (mancanti.length) console.log(`\nEsercizi in archivio senza un documento confrontato: ${mancanti.join(", ")}`);
console.log(differenze ? `\n${differenze} differenze.` : "\nNessuna differenza: il giro completo riproduce i numeri di oggi.");
process.exit(differenze ? 1 : 0);
