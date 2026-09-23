import { strict as assert } from "node:assert";
import { test } from "node:test";

import { colonneDi, leggiRiparto } from "../riparto.ts";
import type { Pagina } from "../rendiconto.ts";

// Le coordinate sono quelle vere di una pagina di riparto: le intestazioni
// stanno su tre righe sovrapposte e gli importi sono allineati a destra,
// qualche punto oltre la parola che li intesta.
function riga(y: number, frammenti: [number, number, string][]) {
  return { y, frammenti: frammenti.map(([x, xFine, testo]) => ({ x, xFine, testo })) };
}

const INTESTAZIONE = [
  riga(700, [
    [19, 39, "Codice"],
    [268, 294, "Millesimi"],
    [309, 335, "Millesimi"],
    [579, 597, "Spese"],
  ]),
  riga(690, [
    [21, 37, "Unità"],
    [269, 294, "Generali"],
    [311, 332, "Scale e"],
    [566, 610, "Riscaldamento"],
  ]),
  riga(680, [[307, 338, "Ascensore"]]),
];

function pagina(righe: ReturnType<typeof riga>[]): Pagina {
  return { numero: 17, righe: [...INTESTAZIONE, ...righe] };
}

test("le colonne si leggono dall'intestazione, su tre righe sovrapposte", () => {
  const colonne = colonneDi(pagina([]));
  assert.ok(colonne);
  assert.deepEqual(
    colonne.map((c) => c.nome),
    ["Millesimi Generali", "Millesimi Scale e Ascensore", "Spese Riscaldamento"]
  );
});

test("una pagina che non è un riparto non ha colonne", () => {
  const altra: Pagina = { numero: 3, righe: [riga(700, [[72, 200, "Relazione dell'amministratore"]])] };
  assert.equal(colonneDi(altra), null);
  assert.equal(leggiRiparto([altra]), null);
});

const UNA_UNITA = [
  riga(650, [
    [15, 26, "009"],
    [119, 157, "Millesimi -->"],
    [279, 300, "68,601"],
    [320, 341, "81,409"],
  ]),
  riga(640, [
    [15, 26, "009"],
    [53, 106, "42 Appartamento"],
    [119, 185, "Talamonti - Cappella"],
    [247, 257, "Pro"],
    [279, 300, "441,86"],
    [320, 341, "464,93"],
    [594, 615, "873,65"],
  ]),
];

test("ogni importo di un'unità finisce nella colonna della sua intestazione", () => {
  const riparto = leggiRiparto([pagina(UNA_UNITA)]);
  assert.ok(riparto);
  assert.equal(riparto.unita.length, 1);

  const unita = riparto.unita[0];
  assert.equal(unita.codice, "009");
  assert.equal(unita.tipologia, "Appartamento");
  assert.equal(unita.nome, "Talamonti - Cappella");
  assert.equal(unita.importi["Millesimi Generali"], 441.86);
  assert.equal(unita.importi["Spese Riscaldamento"], 873.65);
  assert.equal(unita.millesimi["Millesimi Generali"], 68.601);
  assert.equal(unita.totale, 1780.44);
});

test("proprietario e inquilino sono la stessa unità, e si sommano", () => {
  const conInquilino = [
    ...UNA_UNITA,
    riga(630, [
      [15, 26, "009"],
      [119, 215, "Inquilino Rossi"],
      [247, 257, "Inq"],
      [279, 300, "10,00"],
    ]),
  ];
  const riparto = leggiRiparto([pagina(conInquilino)]);
  assert.ok(riparto);
  // La domanda a cui l'app risponde è quanto costa l'appartamento, non a chi
  // è stato addebitato.
  assert.equal(riparto.unita[0].importi["Millesimi Generali"], 451.86);
});

test("il seguito di un'unità che ha cambiato proprietario le appartiene", () => {
  // Il rendiconto stampa il secondo periodo cominciando dalla data, senza
  // ripetere il codice. Prima queste righe sparivano, e nel 2022-2023 erano
  // 87,23 € sui soli millesimi generali.
  const conCambio = [
    ...UNA_UNITA,
    riga(630, [
      [15, 60, "06/05/23"],
      [119, 185, "La Ganga Federica"],
      [247, 257, "Pro"],
      [279, 300, "80,18"],
    ]),
  ];
  const riparto = leggiRiparto([pagina(conCambio)]);
  assert.ok(riparto);
  assert.equal(riparto.unita[0].importi["Millesimi Generali"], 522.04);
});

test("la riga di arrotondamento non appartiene a nessuna unità", () => {
  const conArrotondamento = [
    ...UNA_UNITA,
    riga(620, [
      [15, 150, "Arrotondamenti/Saldo (S.e. & o.)"],
      [279, 300, "-0,07"],
    ]),
  ];
  const riparto = leggiRiparto([pagina(conArrotondamento)]);
  assert.ok(riparto);
  assert.equal(riparto.unita[0].importi["Millesimi Generali"], 441.86);
});

test("la lettura si verifica contro i totali stampati dal documento", () => {
  const conTotali = [
    ...UNA_UNITA,
    riga(600, [
      [15, 100, "Totali Condominio"],
      [279, 300, "441,86"],
      [320, 341, "464,93"],
      [594, 615, "873,65"],
    ]),
  ];
  const riparto = leggiRiparto([pagina(conTotali)]);
  assert.ok(riparto);
  assert.equal(riparto.quadra, true);
  assert.equal(riparto.scarti["Millesimi Generali"], 0);

  // E se una riga sfugge, lo scarto lo dice invece di lasciarlo passare.
  const mancante = [
    UNA_UNITA[0],
    riga(600, [
      [15, 100, "Totali Condominio"],
      [279, 300, "500,00"],
    ]),
  ];
  const monco = leggiRiparto([pagina(mancante)]);
  assert.ok(monco);
  assert.equal(monco.quadra, false);
  assert.equal(monco.scarti["Millesimi Generali"], -500);
});
