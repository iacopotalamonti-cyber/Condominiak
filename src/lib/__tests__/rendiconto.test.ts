import { strict as assert } from "node:assert";
import { test } from "node:test";

import { colonnaDi, importoDi, mappaColonne, type Frammento } from "../rendiconto.ts";

// Le coordinate sono quelle vere di un rendiconto: l'intestazione dichiara
// quattro colonne di importi oltre a quella del movimento.
const INTESTAZIONE: Frammento[] = [
  { x: 305, xFine: 329, testo: "Importo" },
  { x: 362, xFine: 385, testo: "Parziale" },
  { x: 420, xFine: 439, testo: "Totale" },
  { x: 473, xFine: 497, testo: "Parziale" },
  { x: 532, xFine: 550, testo: "Totale" },
];

test("un importo all'italiana diventa un numero, il resto no", () => {
  assert.equal(importoDi("1.250,00"), 1250);
  assert.equal(importoDi("16,96"), 16.96);
  assert.equal(importoDi("-2.422,38"), -2422.38);
  assert.equal(importoDi("001.005"), null);
  assert.equal(importoDi("22/10/25"), null);
  assert.equal(importoDi(""), null);
});

test("una pagina senza intestazione non ha colonne, e non se ne inventano", () => {
  assert.equal(mappaColonne([{ x: 72, xFine: 200, testo: "Relazione dell'amministratore" }]), null);
  // Il solo "Importo" non basta: senza almeno una coppia parziale/totale non
  // siamo nella tabella delle spese.
  assert.equal(mappaColonne([INTESTAZIONE[0]]), null);
});

test("ogni importo finisce nella colonna della propria intestazione", () => {
  const mappa = mappaColonne(INTESTAZIONE);
  assert.ok(mappa);
  assert.equal(colonnaDi(343, mappa), "movimento");
  assert.equal(colonnaDi(399, mappa), "parziale_proprietario");
  assert.equal(colonnaDi(455, mappa), "totale_proprietario");
  assert.equal(colonnaDi(511, mappa), "parziale_inquilino");
  assert.equal(colonnaDi(567, mappa), "totale_inquilino");
});

test("un importo lontano da ogni colonna non viene attribuito a nessuna", () => {
  const mappa = mappaColonne(INTESTAZIONE);
  assert.ok(mappa);
  // Il numero di pagina in fondo al foglio, per esempio.
  assert.equal(colonnaDi(120, mappa), null);
});
