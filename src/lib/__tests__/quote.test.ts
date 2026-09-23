import { strict as assert } from "node:assert";
import { test } from "node:test";

import { collegaQuote, pertinenzeDi, quoteValide, scomponiQuota, tipologiaDi } from "../quote.ts";
import type { QuotaEstratta, QuotaUnita, Unita } from "../types.ts";

function unita(id: string, campi: Partial<Unita>): Unita {
  return {
    id,
    created_at: "",
    condominium_id: "c",
    interno: null,
    codice: null,
    sub: null,
    tipologia: "appartamento",
    piano: null,
    mq: null,
    millesimi: 0,
    nome_proprietario: null,
    email: null,
    telefono: null,
    user_id: null,
    ...campi,
  };
}

function quota(codice: string, nome: string, tipologia = "Appartamento"): QuotaEstratta {
  return { codice, tipologia, sub: "42", nome, importi: {}, millesimi: {}, totale: 0, pagina: 17 };
}

test("la tipologia del documento diventa quella dell'app", () => {
  assert.equal(tipologiaDi("Appartamento"), "appartamento");
  assert.equal(tipologiaDi("Box"), "box");
  assert.equal(tipologiaDi("Cantina"), "cantina");
  assert.equal(tipologiaDi("Posto auto"), "posto_auto");
  assert.equal(tipologiaDi("Lastrico solare"), "altro");
});

test("il codice collega prima di ogni altra cosa", () => {
  const { unitaPerCodice, codiciDaAssegnare } = collegaQuote(
    [quota("009", "Un nome scritto diversamente")],
    [unita("u9", { codice: "009", nome_proprietario: "Talamonti - Cappella" })]
  );
  assert.equal(unitaPerCodice.get("009"), "u9");
  assert.equal(codiciDaAssegnare.length, 0);
});

test("senza codice collega per nome, e assegna il codice per la volta dopo", () => {
  const { unitaPerCodice, codiciDaAssegnare } = collegaQuote(
    [quota("009", "Talamonti - Cappella")],
    [unita("u9", { interno: 9, nome_proprietario: "Talamonti-Cappella" })]
  );
  assert.equal(unitaPerCodice.get("009"), "u9");
  assert.deepEqual(codiciDaAssegnare, [{ unitaId: "u9", codice: "009", sub: "42" }]);
});

test("un nome che identifica due unità non collega nessuna delle due", () => {
  // Lo stesso proprietario con due appartamenti: attaccare la quota al primo
  // sarebbe dare a un appartamento la spesa dell'altro.
  const { unitaPerCodice } = collegaQuote(
    [quota("003", "Rossi Mario")],
    [
      unita("a", { interno: 3, nome_proprietario: "Rossi Mario" }),
      unita("b", { interno: 4, nome_proprietario: "Rossi Mario" }),
    ]
  );
  assert.equal(unitaPerCodice.has("003"), false);
});

test("il nome vale solo dentro la stessa tipologia", () => {
  // La cantina di Talamonti non è il suo appartamento.
  const { unitaPerCodice } = collegaQuote(
    [quota("033", "Talamonti - Cappella", "Cantina")],
    [unita("u9", { interno: 9, nome_proprietario: "Talamonti - Cappella" })]
  );
  assert.equal(unitaPerCodice.has("033"), false);
});

test("un'unità già collegata per codice non si ricollega per nome", () => {
  const { unitaPerCodice } = collegaQuote(
    [quota("009", "Talamonti - Cappella"), quota("099", "Talamonti - Cappella")],
    [unita("u9", { codice: "009", nome_proprietario: "Talamonti - Cappella" })]
  );
  assert.equal(unitaPerCodice.get("009"), "u9");
  assert.equal(unitaPerCodice.has("099"), false);
});

test("dal client passa solo ciò che ha la forma di una quota", () => {
  const valide = quoteValide([
    { codice: "009", tipologia: "Appartamento", nome: "X", importi: { "Millesimi Generali": "441.86", Rotto: "abc" }, totale: 441.86 },
    { codice: "" },
    null,
    "non una quota",
  ]);
  assert.equal(valide.length, 1);
  assert.deepEqual(valide[0].importi, { "Millesimi Generali": 441.86 });
  assert.equal(quoteValide("non un array").length, 0);
});

// La quota vera dell'appartamento 9 nel 2024-2025, come la stampa il riparto.
// Qui una volta c'era un test che affermava 2.095 €: era la divisione dei
// millesimi generali per il totale dell'anno, e il rendiconto dice 2.377,54.
const APPARTAMENTO_9: QuotaUnita = {
  id: "q9",
  created_at: "",
  condominium_id: "c",
  anno: 2025,
  unita_id: "u9",
  codice_unita: "009",
  tipologia: "Appartamento",
  nome_nel_documento: "Talamonti - Cappella",
  importi: {
    "Millesimi Generali": 441.86,
    "Millesimi Scale e Ascensore": 464.93,
    "Millesimi Generali Fotovoltaico": 60.21,
    "Millesimi Gen. NO Posti Auto": 27.15,
    "Millesimi Gen. Conduz. Appartamenti": 14.74,
    "Personali e Rimborsi": 7.09,
    "Spese Riscaldamento": 873.65,
    "Spese Raffr. - ACS - AFS": 487.91,
  },
  millesimi: {
    "Millesimi Generali": 68.601,
    "Millesimi Scale e Ascensore": 81.409,
  },
  totale: 2377.54,
  fonte_documento: null,
  fonte_pagina: 17,
  documento_path: null,
};

test("la quota si divide fra ciò che si consuma e ciò che si riparte", () => {
  const s = scomponiQuota(APPARTAMENTO_9);

  assert.equal(s.totale, 2377.54);
  assert.equal(s.totaleAConsumo, 1368.65);
  assert.equal(s.totalePerMillesimi, 1008.89);

  // Riscaldamento prima, perché è la voce più grossa; il nome perde "Spese".
  assert.deepEqual(s.aConsumo[0], { nome: "Riscaldamento", importo: 873.65, millesimi: null });
  // Ogni voce ripartita porta i millesimi della sua tabella, che non sono gli
  // stessi per tutte: 68,601 sui generali, 81,409 su scale e ascensore.
  assert.deepEqual(s.perMillesimi.slice(0, 2), [
    { nome: "Scale e Ascensore", importo: 464.93, millesimi: 81.409 },
    { nome: "Generali", importo: 441.86, millesimi: 68.601 },
  ]);
});

test("le pertinenze sono le unità dello stesso nome nello stesso rendiconto", () => {
  const cantina: QuotaUnita = {
    ...APPARTAMENTO_9,
    id: "q33",
    codice_unita: "033",
    tipologia: "Cantina",
    importi: { "Millesimi Generali": 2.54 },
    totale: 2.54,
  };
  const altroAnno: QuotaUnita = { ...cantina, id: "vecchia", anno: 2024 };
  const altroNome: QuotaUnita = { ...cantina, id: "altra", codice_unita: "034", nome_nel_documento: "Marmocchi Matteo" };
  const altroAppartamento: QuotaUnita = { ...APPARTAMENTO_9, id: "q10", codice_unita: "010" };

  const trovate = pertinenzeDi(APPARTAMENTO_9, [APPARTAMENTO_9, cantina, altroAnno, altroNome, altroAppartamento]);
  assert.deepEqual(trovate.map((q) => q.id), ["q33"]);
});

test("una voce a credito riduce la quota invece di sparire", () => {
  // Il 2023-2024 dell'appartamento 9: il rimborso assicurativo del
  // condominio torna ai condomini come una voce negativa sui millesimi
  // generali parziali.
  const s = scomponiQuota({
    importi: {
      "Millesimi Generali": 372.18,
      "Millesimi Generali Parziali": -188.77,
      "Millesimi Scale e Ascensore": 489.85,
      "Millesimi Generali Fotovoltaico": 426.93,
      "Millesimi Gen. NO Posti Auto": 126.35,
      "Spese Riscaldamento": 654.49,
      "Spese Raffr. - ACS - AFS": 443.13,
    },
    millesimi: { "Millesimi Generali Parziali": 68.601 },
  });

  assert.equal(s.totale, 2324.16);
  const credito = s.perMillesimi.find((v) => v.nome === "Generali Parziali");
  assert.deepEqual(credito, { nome: "Generali Parziali", importo: -188.77, millesimi: 68.601 });
});
