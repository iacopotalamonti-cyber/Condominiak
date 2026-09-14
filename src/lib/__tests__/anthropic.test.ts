import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAMPI_IMPORTO,
  bilancioVuoto,
  controlliBilancio,
  leggiImporto,
  mergeExtractions,
  normalizeExtraction,
  num,
  scriviImporto,
  sommaSpese,
  type ContestoEstrazione,
} from "../anthropic.ts";

const ctx: ContestoEstrazione = { documento: "bilancio.pdf", offsetPagina: 0, citazioni: [] };

// Il caso che faceva finire in dashboard numeri assenti da qualunque
// documento: il punto delle migliaia letto come separatore decimale.
test("num() legge gli importi nel formato italiano", () => {
  assert.equal(num("48.500"), 48500);
  assert.equal(num("2.500"), 2500);
  assert.equal(num("1.234,56"), 1234.56);
  assert.equal(num("€ 12.345,00"), 12345);
  assert.equal(num("12.345.678"), 12345678);
  assert.equal(num("1.234.567,89"), 1234567.89);
});

test("num() legge anche il formato anglosassone e i numeri nudi", () => {
  assert.equal(num("12,345.67"), 12345.67);
  assert.equal(num(12345.67), 12345.67);
  assert.equal(num("350"), 350);
  assert.equal(num("1,5"), 1.5);
});

test("num() riconosce i negativi e scarta ciò che non è un numero", () => {
  assert.equal(num("-1.200,50"), -1200.5);
  assert.equal(num("(350,00)"), -350);
  assert.equal(num(""), 0);
  assert.equal(num("n.d."), 0);
  assert.equal(num(null), 0);
  assert.equal(num(Number.NaN), 0);
});

test("ogni importo si porta dietro pagina e testo del documento", () => {
  const result = normalizeExtraction(
    {
      bilanci: [
        {
          anno: 2023,
          cons: { v: 48500, pag: 4, txt: "TOTALE CONSUNTIVO 48.500,00" },
          spese: { riscaldamento: { v: 12345.67, pag: 3, txt: "Riscaldamento 12.345,67" } },
        },
      ],
    },
    ctx
  );

  const bilancio = result.bilanci[0];
  assert.equal(bilancio.cons, 48500);
  assert.equal(bilancio.fonti.cons?.pagina, 4);
  assert.equal(bilancio.fonti.cons?.testo, "TOTALE CONSUNTIVO 48.500,00");
  assert.equal(bilancio.spese.riscaldamento, 12345.67);
  assert.equal(bilancio.fonti["spesa.riscaldamento"]?.pagina, 3);
});

// Il modello numera le pagine del blocco che riceve: senza l'offset la fonte
// rimanda alla pagina sbagliata del PDF, che è come non averla.
test("le pagine dei blocchi sono riportate al documento intero", () => {
  const result = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 1000, pag: 2, txt: "Totale 1.000,00" } }] },
    { ...ctx, offsetPagina: 20 }
  );
  assert.equal(result.bilanci[0].fonti.cons?.pagina, 22);
});

test("una citazione dell'API marca l'importo come verificato", () => {
  const result = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "TOTALE 48.500,00" } }] },
    { ...ctx, citazioni: [{ pagina: 4, testo: "TOTALE CONSUNTIVO 48.500,00 euro" }] }
  );
  assert.equal(result.bilanci[0].fonti.cons?.verificata, true);
});

test("senza citazione corrispondente l'importo resta non verificato", () => {
  const result = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "TOTALE 48.500,00" } }] },
    { ...ctx, citazioni: [{ pagina: 4, testo: "TOTALE CONSUNTIVO 39.900,00 euro" }] }
  );
  assert.equal(result.bilanci[0].fonti.cons?.verificata, false);
});

// Lo schema non suggerisce più cinque anni: se il documento ne contiene uno,
// deve uscirne uno.
test("i bilanci vuoti non diventano righe dello storico", () => {
  const result = normalizeExtraction(
    {
      bilanci: [
        { anno: 2023, cons: { v: 1000, pag: 1, txt: "Totale 1.000,00" } },
        { anno: 0, cons: { v: 0, pag: 0, txt: "" } },
      ],
    },
    ctx
  );
  assert.equal(result.bilanci.length, 1);
  assert.equal(result.bilanci[0].anno, 2023);
});

test("le spese restano attaccate al proprio anno", () => {
  const a = normalizeExtraction(
    { bilanci: [{ anno: 2023, spese: { ascensore: { v: 900, pag: 2, txt: "Ascensore 900,00" } } }] },
    ctx
  );
  const b = normalizeExtraction(
    { bilanci: [{ anno: 2022, spese: { ascensore: { v: 700, pag: 2, txt: "Ascensore 700,00" } } }] },
    ctx
  );

  const merged = mergeExtractions([a, b]);
  const anno2023 = merged.bilanci.find((x) => x.anno === 2023);
  const anno2022 = merged.bilanci.find((x) => x.anno === 2022);

  assert.equal(anno2023?.spese.ascensore, 900);
  assert.equal(anno2022?.spese.ascensore, 700);
});

// Prima la confidenza dichiarata dal modello decideva in silenzio quale dei
// due numeri tenere: adesso quello scartato resta visibile.
test("due letture discordanti producono un conflitto, non una scelta silenziosa", () => {
  const a = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "Totale 48.500,00" } }] },
    ctx
  );
  const b = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 45800, pag: 9, txt: "Totale 45.800,00" } }] },
    { ...ctx, documento: "verbale.pdf" }
  );

  const merged = mergeExtractions([a, b]);
  const conflitti = merged.bilanci[0].conflitti.cons;
  assert.equal(conflitti?.length, 1);
  assert.equal(conflitti?.[0].valore, 45800);

  const controlli = controlliBilancio(merged.bilanci[0]);
  assert.ok(controlli.some((c) => c.messaggio.includes("Letture discordanti")));
});

test("una lettura verificata vince su una non verificata", () => {
  const a = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 45800, pag: 9, txt: "Totale 45.800,00" } }] },
    ctx
  );
  const b = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "Totale 48.500,00" } }] },
    { ...ctx, citazioni: [{ pagina: 4, testo: "TOTALE CONSUNTIVO 48.500,00" }] }
  );

  const merged = mergeExtractions([a, b]);
  assert.equal(merged.bilanci[0].cons, 48500);
  assert.equal(merged.bilanci[0].conflitti.cons?.[0].valore, 45800);
});

test("la somma delle voci viene confrontata con il totale del documento", () => {
  const bilancio = bilancioVuoto(2023);
  bilancio.spese.riscaldamento = 12000;
  bilancio.spese.ascensore = 900;
  bilancio.totale = 48500;

  assert.equal(sommaSpese(bilancio.spese), 12900);
  const controlli = controlliBilancio(bilancio);
  assert.ok(controlli.some((c) => c.livello === "errore" && c.campo === "totale"));
});

test("un bilancio che quadra non produce errori di quadratura", () => {
  const bilancio = bilancioVuoto(2023);
  bilancio.spese.riscaldamento = 12000;
  bilancio.spese.ascensore = 900;
  bilancio.totale = 12900;

  const controlli = controlliBilancio(bilancio);
  assert.equal(controlli.filter((c) => c.campo === "totale").length, 0);
});

test("un anno non riconosciuto è un errore bloccante", () => {
  const controlli = controlliBilancio(bilancioVuoto(0));
  assert.ok(controlli.some((c) => c.livello === "errore" && c.campo === ""));
});

test("leggiImporto e scriviImporto coprono tutti i campi dello schema", () => {
  const bilancio = bilancioVuoto(2023);
  for (const [i, campo] of CAMPI_IMPORTO.entries()) {
    scriviImporto(bilancio, campo, i + 1);
  }
  for (const [i, campo] of CAMPI_IMPORTO.entries()) {
    assert.equal(leggiImporto(bilancio, campo), i + 1);
  }
});
