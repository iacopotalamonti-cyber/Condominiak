import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  colonnaDi,
  importoDi,
  leggiVoci,
  mappaColonne,
  totaleVoci,
  type Frammento,
  type Pagina,
} from "../rendiconto.ts";

// Le coordinate sono quelle vere di un rendiconto: l'intestazione dichiara
// quattro colonne di importi oltre a quella del movimento.
const INTESTAZIONE: Frammento[] = [
  { x: 305, xFine: 329, testo: "Importo" },
  { x: 362, xFine: 385, testo: "Parziale" },
  { x: 420, xFine: 439, testo: "Totale" },
  { x: 473, xFine: 497, testo: "Parziale" },
  { x: 532, xFine: 550, testo: "Totale" },
];

function riga(y: number, frammenti: Frammento[]) {
  return { y, frammenti };
}

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

test("il totale della voce è quello della sua colonna, non l'ultimo numero", () => {
  // La riga della voce porta l'importo del movimento (1.250,00), il parziale
  // della voce (1.250,00) e il totale della tabella (5.395,93): prendere
  // l'ultimo numero darebbe il totale della tabella.
  const pagina: Pagina = {
    numero: 6,
    righe: [
      riga(671, INTESTAZIONE),
      riga(625, [
        { x: 38, xFine: 58, testo: "001.001" },
        { x: 72, xFine: 180, testo: "Spese Amministrative" },
      ]),
      riga(612, [
        { x: 72, xFine: 140, testo: "Tosiani Angelo" },
        { x: 317, xFine: 343, testo: "1.250,00" },
        { x: 369, xFine: 399, testo: "1.250,00" },
        { x: 425, xFine: 455, testo: "5.395,93" },
      ]),
    ],
  };

  const { voci, tabelle, pagineLette } = leggiVoci([pagina]);
  assert.deepEqual(pagineLette, [6]);
  assert.equal(voci.length, 1);
  assert.equal(voci[0].codice, "001.001");
  assert.equal(voci[0].descrizione, "Spese Amministrative");
  assert.equal(voci[0].totale, 1250);
  assert.equal(tabelle.length, 1);
  assert.equal(tabelle[0].totale, 5395.93);
});

test("uno storno resta negativo invece di gonfiare il totale", () => {
  const pagina: Pagina = {
    numero: 8,
    righe: [
      riga(671, INTESTAZIONE),
      riga(600, [
        { x: 38, xFine: 58, testo: "300.001" },
        { x: 72, xFine: 190, testo: "Consumi acqua fredda" },
        { x: 481, xFine: 511, testo: "2.422,38" },
      ]),
      riga(580, [
        { x: 38, xFine: 58, testo: "300.003" },
        { x: 72, xFine: 190, testo: "Storno quote Acqua Fredda" },
        { x: 475, xFine: 511, testo: "-2.422,38" },
      ]),
    ],
  };

  const { voci } = leggiVoci([pagina]);
  assert.equal(voci.length, 2);
  assert.equal(voci[1].totaleInquilino, -2422.38);
  // Consumo e storno si annullano: è esattamente ciò che il rendiconto intende.
  assert.equal(totaleVoci(voci), 0);
});

test("le pagine senza la tabella delle spese vengono saltate", () => {
  const riparto: Pagina = {
    numero: 20,
    righe: [riga(700, [{ x: 72, xFine: 300, testo: "Riparto consuntivo gest globale" }])],
  };

  const { voci, pagineLette } = leggiVoci([riparto]);
  assert.equal(voci.length, 0);
  assert.deepEqual(pagineLette, []);
});
