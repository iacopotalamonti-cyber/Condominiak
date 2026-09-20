import { strict as assert } from "node:assert";
import { test } from "node:test";

import { annoEsercizio, estrazioneDa, leggiRendiconto, notaDiLettura } from "../lettura.ts";
import type { Pagina } from "../rendiconto.ts";

// Una pagina finta si costruisce dalle righe: ogni riga è una lista di
// frammenti con la x da cui partono, perché è la posizione che conta.
function pagina(numero: number, righe: [number, string][][]): Pagina {
  return {
    numero,
    righe: righe.map((frammenti, indice) => ({
      y: 800 - indice * 12,
      frammenti: frammenti.map(([x, testo]) => ({
        x,
        xFine: x + testo.length * 5,
        testo,
      })),
    })),
  };
}

function riga(testo: string): [number, string][] {
  return [[72, testo]];
}

test("l'anno dell'esercizio è quello in cui l'esercizio chiude", () => {
  assert.equal(annoEsercizio([pagina(1, [riga("Inizio / Fine Gestione 01-08-2024 - 31-07-2025")])]), 2025);
  assert.equal(annoEsercizio([pagina(1, [riga("RENDICONTO CONSUNTIVO DAL 01/08/2020 AL 31/07/2021")])]), 2021);
  // Senza parole chiave vale il primo intervallo, che è quello di copertina.
  assert.equal(annoEsercizio([pagina(1, [riga("(17/12/2019 - 31/07/2020)")])]), 2020);
});

test("il periodo del preventivo non è l'anno del consuntivo", () => {
  // Lo stesso foglio di convocazione elenca i due esercizi di seguito: quello
  // chiuso e quello che comincia. Prendere il primo intervallo qui darebbe
  // ragione alla riga sbagliata solo per l'ordine in cui è stampata.
  const pagine = [
    pagina(1, [
      riga("- Rendiconto preventivo spese esercizio 01/08/2022 ‐ 31/07/2023 e stati di riparto."),
      riga("- Rendiconto consuntivo spese esercizio 01/08/2021 ‐ 31/07/2022 e stati di riparto."),
    ]),
  ];
  assert.equal(annoEsercizio(pagine), 2022);
});

test("un documento senza date non inventa un anno", () => {
  assert.equal(annoEsercizio([pagina(1, [riga("Relazione dell'amministratore")])]), null);
});

test("un formato sconosciuto non produce una lettura", () => {
  assert.equal(leggiRendiconto([pagina(1, [riga("Bilancio del condominio, anno 2024")])]), null);
});

// Un rendiconto MULTIGEST in miniatura: due conti che dichiarano il proprio
// totale, e il totale spese in fondo.
const MULTIGEST_FINTO: Pagina[] = [
  pagina(1, [
    riga("RENDICONTO CONSUNTIVO DAL 01/08/2020 AL 31/07/2021"),
    riga("CONTO N. 1 - GENERALI"),
    riga("Tot. Conto n.1 € 100,00"),
    riga("CONTO N. 15 - ASCENSORE"),
    riga("Tot. Conto n.15 € 50,00"),
    riga("TOTALE SPESE € 150,00"),
  ]),
];

test("una lettura che quadra è utilizzabile, e sa a che anno appartiene", () => {
  const letto = leggiRendiconto(MULTIGEST_FINTO);
  assert.ok(letto);
  assert.equal(letto.formato, "MULTIGEST");
  assert.equal(letto.anno, 2021);
  assert.equal(letto.motivo, null);
  assert.equal(letto.lettura.scarto, 0);

  const estratto = estrazioneDa(letto, "prova.pdf");
  assert.equal(estratto.anno, 2021);
  assert.equal(estratto.totale, 150);
  assert.equal(estratto.spese.amm, 100);
  assert.equal(estratto.spese.ascensore, 50);
  // Ogni categoria dice da dove viene, e la fonte è verificata perché il
  // numero l'abbiamo letto noi, non ce l'ha detto un modello.
  assert.equal(estratto.fonti["spesa.amm"]?.verificata, true);
  assert.match(estratto.fonti["spesa.amm"]!.testo, /^1 100,00$/);
});

test("un conto che il profilo non conosce ferma la lettura invece di perdere l'importo", () => {
  const pagine: Pagina[] = [
    pagina(1, [
      riga("RENDICONTO CONSUNTIVO DAL 01/08/2020 AL 31/07/2021"),
      riga("Tot. Conto n.1 € 100,00"),
      riga("Tot. Conto n.99 € 50,00"),
      riga("TOTALE SPESE € 150,00"),
    ]),
  ];
  const letto = leggiRendiconto(pagine);
  assert.ok(letto);
  assert.match(letto.motivo ?? "", /voci senza categoria: 99/);
});

test("se le voci non tornano con il totale stampato la lettura si dichiara sbagliata", () => {
  const pagine: Pagina[] = [
    pagina(1, [
      riga("RENDICONTO CONSUNTIVO DAL 01/08/2020 AL 31/07/2021"),
      riga("Tot. Conto n.1 € 100,00"),
      riga("TOTALE SPESE € 150,00"),
    ]),
  ];
  const letto = leggiRendiconto(pagine);
  assert.ok(letto);
  assert.match(letto.motivo ?? "", /non tornano con il totale stampato/);
});

test("le partite di un singolo condomino non entrano nelle spese comuni", () => {
  // Il conto 12 sono spese riaddebitate a chi le ha causate: stanno dentro il
  // totale stampato, ma non sono spesa del condominio.
  const pagine: Pagina[] = [
    pagina(1, [
      riga("RENDICONTO CONSUNTIVO DAL 01/08/2020 AL 31/07/2021"),
      riga("Tot. Conto n.1 € 100,00"),
      riga("Tot. Conto n.12 € 20,00"),
      riga("TOTALE SPESE € 120,00"),
    ]),
  ];
  const letto = leggiRendiconto(pagine);
  assert.ok(letto);
  assert.equal(letto.motivo, null);
  assert.equal(letto.classificazione.totaleSpese, 100);
  assert.equal(letto.classificazione.totaleRimborsi, 20);
  // Il totale resta quello stampato sul documento, perché è la cifra che il
  // condomino ritrova sulla carta; il consuntivo è quanto è stato speso
  // davvero, e la partita personale è registrata a parte.
  const estratto = estrazioneDa(letto, "prova.pdf");
  assert.equal(estratto.totale, 120);
  assert.equal(estratto.cons, 100);
  assert.deepEqual(
    estratto.incassi.map((i) => [i.codice, i.importo]),
    [["12", 20]]
  );
  // E la differenza col totale stampato viene detta, non nascosta.
  assert.match(notaDiLettura(letto), /120,00 perché comprende anche partite di singoli condomini/);
});
