import { strict as assert } from "node:assert";
import { test } from "node:test";

import { chiaveFornitore, indiceFornitori, trovaFornitore } from "../fornitori.ts";
import type { Fornitore } from "../types.ts";

const fornitore = (id: string, nome: string): Fornitore => ({
  id,
  nome,
  alias: [],
  created_at: "",
  condominium_id: "c",
  piva: null,
  note: null,
});

const INDICE = indiceFornitori([
  fornitore("sg", "S.G Service snc di Sturba Leonardo e Gabrielli Paolo"),
  fornitore("comune", "Comune di Bologna - Passi Carrai"),
  fornitore("gas", "Hera Gas"),
  fornitore("acqua", "Hera acqua"),
]);

test("un nome tagliato dalla colonna del PDF ritrova il suo fornitore", () => {
  assert.equal(trovaFornitore(INDICE, chiaveFornitore("S.G Service SNC di Sturba Leon"))?.id, "sg");
  assert.equal(trovaFornitore(INDICE, chiaveFornitore("Comune di Bologna - Passi Carr"))?.id, "comune");
});

test("il nome intero si ritrova come prima", () => {
  assert.equal(trovaFornitore(INDICE, chiaveFornitore("Hera Gas"))?.id, "gas");
});

test("un inizio corto o condiviso non sceglie a caso", () => {
  // "Hera" è l'inizio di due fornitori: nessuno dei due.
  assert.equal(trovaFornitore(INDICE, chiaveFornitore("Hera")), undefined);
  assert.equal(trovaFornitore(INDICE, chiaveFornitore("Otis Servizi")), undefined);
});
