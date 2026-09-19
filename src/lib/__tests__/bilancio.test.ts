import assert from "node:assert/strict";
import { test } from "node:test";

import { TOLLERANZA_QUADRATURA, esercizi, esercizioCorrente, totaleEsercizio } from "../bilancio.ts";
import {
  EXTRACTION_EFFORT,
  bilancioVuoto,
  controlliBilancio,
  effortValido,
  emptyExtraction,
  mergeExtractions,
} from "../anthropic.ts";
import {
  formatUso,
  millesimiIncompleti,
  quotaAnnua,
  sommaMillesimi,
} from "../condotwin-calculations.ts";
import type { Bilancio, Spesa } from "../types.ts";

function bilancio(anno: number, campi: Partial<Bilancio> = {}): Bilancio {
  return {
    id: `b-${anno}`,
    created_at: "",
    condominium_id: "c",
    anno,
    preventivo: null,
    consuntivo: null,
    fondo_riserva: null,
    totale_documento: null,
    fonti: null,
    documento_path: null,
    note: null,
    ...campi,
  };
}

function spesa(anno: number, categoria: string, importo: number): Spesa {
  return {
    id: `${anno}-${categoria}`,
    created_at: "",
    condominium_id: "c",
    anno,
    categoria,
    importo,
    fonte_documento: null,
    fonte_pagina: null,
    fonte_testo: null,
    fonte_verificata: false,
    fonte_verificabile: false,
    documento_path: null,
    note: null,
  };
}

// Il caso reale che ha fatto nascere questo modulo: nove voci che sommano
// 20.784,30 mentre il documento stampa 27.748,85. Il totale da mostrare è
// quello del documento, e la differenza è una quantità visibile, non un buco.
test("il totale del documento batte la somma delle voci", () => {
  const e = totaleEsercizio(2024, bilancio(2024, { totale_documento: 27748.85, consuntivo: 27748.85 }), [
    spesa(2024, "riscaldamento", 6986.56),
    spesa(2024, "varie", 3042.65),
    spesa(2024, "acqua", 2422.38),
    spesa(2024, "pulizia", 2281.4),
    spesa(2024, "assicurazione", 2157.1),
    spesa(2024, "ascensore", 1553.11),
    spesa(2024, "amm", 1250),
    spesa(2024, "manutenzione", 880),
    spesa(2024, "illuminazione", 211.1),
  ]);

  assert.equal(e.totale, 27748.85);
  assert.equal(e.origine, "documento");
  assert.equal(e.sommaVoci, 20784.3);
  assert.equal(e.nonClassificato, 6964.55);
  assert.equal(e.eccedenza, 0);
  assert.equal(e.quadra, false);
});

test("senza totale del documento vale il consuntivo registrato", () => {
  const e = totaleEsercizio(2023, bilancio(2023, { consuntivo: 5000 }), [spesa(2023, "acqua", 1000)]);
  assert.equal(e.totale, 5000);
  assert.equal(e.origine, "consuntivo");
  assert.equal(e.nonClassificato, 4000);
});

test("senza alcun totale dichiarato valgono le voci", () => {
  const e = totaleEsercizio(2022, undefined, [
    spesa(2022, "acqua", 1000),
    spesa(2022, "pulizia", 500),
  ]);
  assert.equal(e.totale, 1500);
  assert.equal(e.origine, "voci");
  assert.equal(e.nonClassificato, 0);
  assert.equal(e.quadra, true);
});

// Un preventivo è una previsione: non può diventare la spesa dell'esercizio.
test("il preventivo non viene mai usato come spesa", () => {
  const e = totaleEsercizio(2026, bilancio(2026, { preventivo: 30000 }), []);
  assert.equal(e.totale, 0);
  assert.equal(e.origine, "assente");
});

test("le voci che superano il totale sono un'eccedenza, non un totale più alto", () => {
  const e = totaleEsercizio(2023, bilancio(2023, { totale_documento: 1000 }), [
    spesa(2023, "acqua", 900),
    spesa(2023, "pulizia", 400),
  ]);
  assert.equal(e.totale, 1000);
  assert.equal(e.eccedenza, 300);
  assert.equal(e.nonClassificato, 0);
  assert.equal(e.quadra, false);
});

test("uno scarto entro la tolleranza di arrotondamento quadra", () => {
  const e = totaleEsercizio(2023, bilancio(2023, { totale_documento: 1000.5 }), [
    spesa(2023, "acqua", 1000),
  ]);
  assert.equal(e.quadra, true);
  assert.equal(e.nonClassificato, 0);
});

// Il 2022 esiste solo come voci di spesa, senza riga in bilanci: deve comunque
// comparire fra gli esercizi.
test("un anno con sole voci di spesa resta un esercizio", () => {
  const lista = esercizi(
    [bilancio(2024, { consuntivo: 100 })],
    [spesa(2024, "acqua", 100), spesa(2022, "acqua", 50)]
  );
  assert.deepEqual(lista.map((e) => e.anno), [2024, 2022]);
  assert.equal(lista[1].totale, 50);
});

test("l'esercizio corrente è l'anno in corso, altrimenti il più recente", () => {
  const bilanci = [bilancio(2024, { consuntivo: 100 }), bilancio(2022, { consuntivo: 50 })];
  const spese = [spesa(2024, "acqua", 100), spesa(2022, "acqua", 50)];

  assert.equal(esercizioCorrente(bilanci, spese, 2022)?.anno, 2022);
  assert.equal(esercizioCorrente(bilanci, spese, 2030)?.anno, 2024);
  assert.equal(esercizioCorrente([], [], 2030), null);
});

// I due moduli tengono la stessa soglia di quadratura senza importarsela a
// vicenda: se qualcuno ne cambia una sola, l'estrazione segnalerebbe uno scarto
// che l'interfaccia considera ancora accettabile, o viceversa.
test("estrazione e interfaccia usano la stessa tolleranza", () => {
  const dentro = bilancioVuoto(2024);
  dentro.totale = 1000 + TOLLERANZA_QUADRATURA;
  dentro.spese.acqua = 1000;
  assert.equal(
    controlliBilancio(dentro).some((c) => c.campo === "totale"),
    false,
    "uno scarto pari alla tolleranza non deve essere segnalato da nessuna delle due parti"
  );

  const fuori = bilancioVuoto(2024);
  fuori.totale = 1000 + TOLLERANZA_QUADRATURA + 0.01;
  fuori.spese.acqua = 1000;
  assert.equal(
    controlliBilancio(fuori).some((c) => c.campo === "totale"),
    true
  );
  assert.equal(totaleEsercizio(2024, { totale_documento: fuori.totale, consuntivo: null }, [
    { importo: 1000 },
  ]).quadra, false);
});

// La leva di costo più grossa dell'applicazione è il modello: deve essere
// cambiabile senza un rilascio, e un refuso nella variabile d'ambiente non
// deve far fallire ogni estrazione con un 400.
test("un effort non riconosciuto ricade sul predefinito", () => {
  assert.equal(effortValido("low"), "low");
  assert.equal(effortValido("max"), "max");
  assert.equal(effortValido("altissimo"), EXTRACTION_EFFORT);
  assert.equal(effortValido(""), EXTRACTION_EFFORT);
  assert.equal(effortValido(undefined), EXTRACTION_EFFORT);
});

test("il consumo di token si somma fra i blocchi analizzati", () => {
  const a = { ...emptyExtraction(), uso: { chiamate: 1, tokenIngresso: 30000, tokenUscita: 2000 } };
  const b = { ...emptyExtraction(), uso: { chiamate: 1, tokenIngresso: 28000, tokenUscita: 1500 } };

  const merged = mergeExtractions([a, b]);
  assert.deepEqual(merged.uso, { chiamate: 2, tokenIngresso: 58000, tokenUscita: 3500 });
  assert.equal(formatUso(merged.uso), "Analisi: 2 chiamate al modello, 58k token in ingresso e 3.5k in uscita.");
});

// La tabella millesimale del condominio somma 908,53 e non 1000: dividere per
// un 1000 teorico sottostimava ogni rata del 9% senza segnalarlo.
test("le quote si ripartiscono sui millesimi realmente registrati", () => {
  const unita = [{ millesimi: 68.6 }, { millesimi: 839.93 }];
  const totale = sommaMillesimi(unita);

  assert.equal(totale, 908.53);
  assert.equal(millesimiIncompleti(totale), true);
  assert.equal(quotaAnnua(68.6, 27748.85, totale), 2095);
  assert.equal(quotaAnnua(68.6, 27748.85), 1904, "senza il totale reale la quota è sottostimata");
});

test("una tabella millesimale completa non viene segnalata", () => {
  const totale = sommaMillesimi([{ millesimi: 500 }, { millesimi: 500 }]);
  assert.equal(millesimiIncompleti(totale), false);
  assert.equal(quotaAnnua(500, 10000, totale), 5000);
});

// La somma delle quote deve coprire la spesa: è il senso stesso del riparto.
test("le quote di tutte le unità sommano alla spesa dell'esercizio", () => {
  const unita = [{ millesimi: 68.6 }, { millesimi: 439.93 }, { millesimi: 400 }];
  const totale = sommaMillesimi(unita);
  const spesa = 27748.85;

  const somma = unita.reduce((t, u) => t + quotaAnnua(u.millesimi, spesa, totale), 0);
  assert.ok(Math.abs(somma - spesa) <= unita.length, `le quote sommano ${somma} invece di ${spesa}`);
});
