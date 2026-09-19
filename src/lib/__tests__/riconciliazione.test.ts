import assert from "node:assert/strict";
import test from "node:test";

import { riconcilia } from "../riconciliazione.ts";
import type { CategoriaSpesa, ExtractedMovimento } from "../types.ts";

function mov(
  pagina: number,
  importo: number,
  descrizione = `riga ${pagina}/${importo}`,
  categoria: CategoriaSpesa = "varie",
  data = ""
): ExtractedMovimento {
  return {
    data,
    descrizione,
    fornitore: "",
    categoria,
    importo,
    fonte: { documento: "rendiconto.pdf", pagina, testo: descrizione, verificata: true, verificabile: true },
  };
}

// I totali per pagina sono quelli veri del rendiconto 2024 di Via Enriques 3,
// letti dal database dopo l'estrazione. Le pagine 6-14 sono il registro
// analitico e sommano esattamente al totale stampato; 27, 28 e 37 sono
// prospetti di riparto e rimettono in conto le stesse spese una seconda volta.
const PAGINE_2024: [number, number][] = [
  [6, 6440.93],
  [7, 3377.5],
  [8, 775.83],
  [9, 7421.06],
  [10, 4637.46],
  [13, 3436.87],
  [14, 1659.2],
  [27, 5766.02],
  [28, 7874.15],
  [37, 7788.75],
];

const TOTALE_STAMPATO_2024 = 27748.85;

test("il rendiconto 2024 torna al totale stampato scartando le pagine di riparto", () => {
  const movimenti = PAGINE_2024.map(([pagina, importo]) => mov(pagina, importo));

  // Il punto di partenza: 49.177,77 € contro i 27.748,85 € stampati.
  assert.equal(
    movimenti.reduce((a, m) => a + m.importo, 0).toFixed(2),
    "49177.77"
  );

  const r = riconcilia(movimenti, TOTALE_STAMPATO_2024);

  assert.equal(r.esito, "quadra");
  assert.equal(r.somma, TOTALE_STAMPATO_2024);
  assert.equal(r.scarto, 0);
  assert.deepEqual(r.pagineTenute, [6, 7, 8, 9, 10, 13, 14]);
  assert.deepEqual(r.pagineScartate, [27, 28, 37]);
});

test("le spese per categoria si ricalcolano sui movimenti tenuti, non su quelli letti", () => {
  const movimenti = [
    mov(6, 10000, "caldaia", "riscaldamento"),
    mov(7, 5000, "manutenzione ascensore", "ascensore"),
    // La stessa caldaia, rimessa in conto dal prospetto di riparto.
    mov(30, 10000, "caldaia", "riscaldamento"),
  ];

  const r = riconcilia(movimenti, 15000);

  assert.equal(r.esito, "quadra");
  assert.equal(r.spese.riscaldamento, 10000);
  assert.equal(r.spese.ascensore, 5000);
  assert.equal(r.spese.acqua, 0);
});

test("una riga ripetuta su un'altra pagina viene riconosciuta anche senza intervallo contiguo", () => {
  const movimenti = [
    mov(5, 1000, "ENEL ENERGIA fattura 12", "illuminazione", "2024-03-01"),
    mov(9, 500, "pulizia scale marzo", "pulizia", "2024-03-31"),
    mov(7, 1000, "ENEL ENERGIA, fattura 12", "illuminazione", "2024-03-01"),
  ];

  const r = riconcilia(movimenti, 1500);

  assert.equal(r.esito, "quadra");
  assert.equal(r.movimenti.length, 2);
  assert.equal(r.strategia, "senza le righe ripetute");
});

test("due pagamenti identici sulla stessa pagina sono due pagamenti, non un duplicato", () => {
  const movimenti = [
    mov(6, 250, "rata assicurazione", "assicurazione", "2024-06-01"),
    mov(6, 250, "rata assicurazione", "assicurazione", "2024-06-01"),
  ];

  const r = riconcilia(movimenti, 500);

  assert.equal(r.esito, "quadra");
  assert.equal(r.movimenti.length, 2);
  assert.equal(r.somma, 500);
});

test("se nessuna lettura arriva al totale stampato non si scarta niente", () => {
  const movimenti = [mov(6, 1000), mov(7, 2000), mov(20, 3000)];

  // 15.000 € non è raggiungibile da nessun sottoinsieme: l'elenco è incompleto.
  const r = riconcilia(movimenti, 15000);

  assert.equal(r.esito, "non_riconciliata");
  assert.equal(r.movimenti.length, 3);
  assert.equal(r.scartati.length, 0);
  assert.equal(r.strategia, "tutte le righe");
  assert.equal(r.somma, 6000);
  assert.equal(r.scarto, -9000);
});

test("senza totale stampato non si riconcilia e non si butta via niente", () => {
  const movimenti = [mov(6, 1000), mov(28, 1000)];

  const r = riconcilia(movimenti, 0);

  assert.equal(r.esito, "non_riconciliata");
  assert.equal(r.strategia, "nessuna");
  assert.equal(r.movimenti.length, 2);
});

test("uno scarto sotto l'1% è dichiarato avvicinato, non spacciato per quadratura", () => {
  const movimenti = [mov(6, 9950), mov(30, 4000)];

  const r = riconcilia(movimenti, 10000);

  assert.equal(r.esito, "avvicinata");
  assert.equal(r.somma, 9950);
  assert.equal(r.scarto, -50);
});

test("le righe senza pagina restano: escluderle sarebbe una scelta non misurabile", () => {
  const movimenti = [
    { ...mov(6, 1000), fonte: null },
    mov(7, 2000),
    mov(30, 5000),
  ];

  const r = riconcilia(movimenti, 3000);

  assert.equal(r.esito, "quadra");
  assert.equal(r.movimenti.length, 2);
  assert.ok(r.movimenti.some((m) => m.fonte === null));
});
