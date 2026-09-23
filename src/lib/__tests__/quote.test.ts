import { strict as assert } from "node:assert";
import { test } from "node:test";

import { collegaQuote, quoteValide, tipologiaDi } from "../quote.ts";
import type { QuotaEstratta, Unita } from "../types.ts";

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
