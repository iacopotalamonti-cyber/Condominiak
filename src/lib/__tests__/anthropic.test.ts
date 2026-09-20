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
  pagineDiRiparto,
  paginaDiRiparto,
  promptCorrezione,
  verificaImporto,
  type ContestoEstrazione,
} from "../anthropic.ts";

const ctx: ContestoEstrazione = {
  documento: "bilancio.pdf",
  offsetPagina: 0,
  testoPagine: new Map(),
};

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

// La verifica confronta l'importo con il testo vero della pagina, estratto dal
// PDF da noi: non dipende da cosa il modello sceglie di scrivere.
test("l'importo ritrovato nella pagina dichiarata è verificato", () => {
  const result = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "TOTALE 48.500,00" } }] },
    { ...ctx, testoPagine: new Map([[4, "TOTALE CONSUNTIVO 48.500,00 euro"]]) }
  );
  assert.equal(result.bilanci[0].fonti.cons?.verificata, true);
  assert.equal(result.bilanci[0].fonti.cons?.verificabile, true);
});

test("un importo assente dalla pagina dichiarata non è verificato", () => {
  const result = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "TOTALE 48.500,00" } }] },
    { ...ctx, testoPagine: new Map([[4, "TOTALE CONSUNTIVO 39.900,00 euro"]]) }
  );
  assert.equal(result.bilanci[0].fonti.cons?.verificata, false);
  assert.equal(result.bilanci[0].fonti.cons?.verificabile, true);
});

// Una scansione non ha testo: "non ho potuto controllare" non deve assomigliare
// a "ho controllato e non c'è".
test("senza testo nel PDF la verifica risulta impossibile, non fallita", () => {
  const result = normalizeExtraction(
    { bilanci: [{ anno: 2023, cons: { v: 48500, pag: 4, txt: "TOTALE 48.500,00" } }] },
    ctx
  );
  assert.equal(result.bilanci[0].fonti.cons?.verificata, false);
  assert.equal(result.bilanci[0].fonti.cons?.verificabile, false);
});

// Una tabella che prosegue oltre il salto pagina fa sbagliare il modello di una
// pagina: in quel caso il numero è comunque quello giusto. Due pagine di scarto
// no, altrimenti si finirebbe per verificare qualsiasi cosa.
test("la verifica tollera uno scarto di una pagina, non di più", () => {
  const pagine = new Map([
    [4, "intestazione"],
    [5, "segue: Riscaldamento 6.986,56"],
    [6, "altre voci"],
    [7, "ancora altre voci"],
  ]);

  assert.equal(verificaImporto(6986.56, 4, pagine), "verificata");
  assert.equal(verificaImporto(6986.56, 5, pagine), "verificata");
  assert.equal(verificaImporto(6986.56, 6, pagine), "verificata");
  assert.equal(verificaImporto(6986.56, 7, pagine), "non_trovata");
});

// Pagina dichiarata senza testo estraibile (inserto scansionato): non si è
// potuto controllare, e non è la stessa cosa di un importo assente.
test("una pagina priva di testo rende la verifica impossibile", () => {
  const pagine = new Map([[5, "Riscaldamento 6.986,56"]]);
  assert.equal(verificaImporto(6986.56, 9, pagine), "non_verificabile");
  assert.equal(verificaImporto(6986.56, 0, pagine), "non_verificabile");
  assert.equal(verificaImporto(6986.56, 5, new Map()), "non_verificabile");
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
    { ...ctx, testoPagine: new Map([[4, "TOTALE CONSUNTIVO 48.500,00"]]) }
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

// Il riparto è la causa dell'eccedenza di 21.428,92 sul rendiconto reale:
// riconoscerlo dal testo della pagina non dipende dal formato del documento.
test("una tabella di riparto viene riconosciuta dal testo", () => {
  assert.equal(paginaDiRiparto("TABELLA MILLESIMALE GENERALE — riparto spese anno 2024"), true);
  assert.equal(
    paginaDiRiparto(
      "Totale Fatture Gas per RISCALDAMENTO (80% spesa periodo Invernale) 4.865,32 " +
        "Manutenzione C.T. (100% Mm Cli nuovi) 2.213,03 Forza Motrice (80% Totale spesa) 710,40"
    ),
    true,
    "le percentuali di attribuzione sono la firma del riparto"
  );
  assert.equal(
    paginaDiRiparto("Prospetto di ripartizione — interno n. 9 scala A millesimi 68,60"),
    true
  );
});

// "Spesa ripartizione costi" è una voce di spesa vera: il servizio di lettura
// dei contatori. Un solo indizio non deve far scartare una pagina buona.
test("l'elenco spese non viene scambiato per un riparto", () => {
  assert.equal(
    paginaDiRiparto(
      "001.005 Assicurazione UnipolSai Assicurazioni S.p.A. 2.157,10 " +
        "002.004 Canone manutenzione impianto ascensore Otis 1.553,11 " +
        "300.001 Spesa ripartizione costi AFS Bemati Energy srl 85,40"
    ),
    false
  );
  assert.equal(paginaDiRiparto(""), false);
  assert.equal(paginaDiRiparto("Totale Gen. 27.748,85"), false);
});

test("le pagine di riparto vengono elencate in ordine", () => {
  const pagine = new Map([
    [3, "001.001 Spese Amministrative Tosiani Angelo 1.586,00"],
    [27, "Riparto generale spese — millesimi per interno"],
    [28, "Totale Gas (80% periodo invernale) 4.865,32 Manutenzione (100% Mm) 2.213,03 (60% estiva) 480,48"],
  ]);
  assert.deepEqual(pagineDiRiparto(pagine), [27, 28]);
});

// La rilettura ripeteva il prompt identico e rifaceva lo stesso errore: ora
// porta con sé lo scarto, che è l'unica cosa che il modello non poteva sapere.
test("la correzione dice al modello quanto e in che direzione sbaglia", () => {
  const eccesso = promptCorrezione(49177.77, 27748.85, [27, 28]);
  assert.match(eccesso, /DI TROPPO/);
  assert.match(eccesso, /21\.428,92/);
  assert.match(eccesso, /pagine 27, 28/);

  // L'italiano non raggruppa le migliaia sotto le cinque cifre: 6964,55 ma
  // 27.748,85. Il confronto guarda le cifre, non la punteggiatura.
  const difetto = promptCorrezione(20784.3, 27748.85, []);
  assert.match(difetto, /MANCANO/);
  assert.match(difetto, /6\.?964,55/);
  assert.doesNotMatch(difetto, /pagine/);
});

test("un bilancio senza nessun importo è una lettura fallita, non un bilancio che quadra", () => {
  const controlli = controlliBilancio(bilancioVuoto(2025));

  // Senza questo controllo i controlli aritmetici tacevano, l'interfaccia
  // mostrava il verde «i conti tornano» e il salvataggio cancellava i dati
  // buoni già in archivio per quell'anno.
  assert.ok(controlli.some((c) => c.livello === "errore" && /nessun importo/.test(c.messaggio)));
});

test("un bilancio con un solo importo non viene scambiato per vuoto", () => {
  const bilancio = bilancioVuoto(2025);
  bilancio.totale = 27748.85;

  const controlli = controlliBilancio(bilancio);
  assert.equal(controlli.filter((c) => /nessun importo/.test(c.messaggio)).length, 0);
});

test("un importo di poche cifre si verifica sulla forma stampata, non sulle cifre nude", () => {
  const pagine = new Map([[9, "S.G Service Intervento del 01/08/2024 di campionatura acqua 679 08/08/24 55,00"]]);

  // Prima questi importi erano dichiarati «non verificabili», e ogni spesa
  // sotto i 100 € si portava dietro un punto interrogativo.
  assert.equal(verificaImporto(55, 9, pagine), "verificata");
});

test("un importo di poche cifre non si verifica su un numero che lo contiene", () => {
  // 55 compare dentro 1.550,00 e dentro il numero di fattura 655, ma la spesa
  // da 55,00 su questa pagina non c'è.
  const pagine = new Map([[9, "Fattura 655 del 12/03/2024 importo 1.550,00 e 55 euro di acconto"]]);

  assert.equal(verificaImporto(55, 9, pagine), "non_trovata");
});
