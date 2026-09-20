import { strict as assert } from "node:assert";
import { test } from "node:test";

import { leggi, riconosci, type ProfiloFormato } from "../motore.ts";
import { CONTAVALLI, MULTIGEST, PROFILI, TOSIANI } from "../profili.ts";
import type { Frammento, Pagina } from "../rendiconto.ts";

function riga(y: number, frammenti: Frammento[]) {
  return { y, frammenti };
}
function testo(x: number, s: string): Frammento {
  return { x, xFine: x + s.length * 5, testo: s };
}
function importo(xFine: number, s: string): Frammento {
  return { x: xFine - 40, xFine, testo: s };
}

// Sei colonne: movimento, parziale e totale del proprietario, parziale e
// totale del conduttore.
const COLONNE_TOSIANI: Frammento[] = [
  { x: 305, xFine: 329, testo: "Importo" },
  { x: 362, xFine: 385, testo: "Parziale" },
  { x: 420, xFine: 439, testo: "Totale" },
  { x: 473, xFine: 497, testo: "Parziale" },
  { x: 532, xFine: 550, testo: "Totale" },
];

const COLONNE_CONTAVALLI: Frammento[] = [
  { x: 280, xFine: 304, testo: "Importo" },
  { x: 330, xFine: 353, testo: "Parziale" },
  { x: 390, xFine: 409, testo: "Totale" },
];

test("ogni formato si riconosce dalla propria impronta", () => {
  const con = (s: string): Pagina[] => [{ numero: 1, righe: [riga(700, [testo(30, s)])] }];
  assert.equal(riconosci(con("Elenco voci di spesa consuntivo"), PROFILI)?.nome, TOSIANI.nome);
  assert.equal(riconosci(con("Bilancio dettagliato per conto"), PROFILI)?.nome, CONTAVALLI.nome);
  assert.equal(riconosci(con("Tot. Conto n.9 € 8,98"), PROFILI)?.nome, MULTIGEST.nome);
});

test("un formato sconosciuto resta tale: è l'informazione che serve", () => {
  const ignoto: Pagina[] = [{ numero: 1, righe: [riga(700, [testo(30, "Rendiconto di qualcun altro")])] }];
  assert.equal(riconosci(ignoto, PROFILI), null);
});

test("la stessa colonna vale diversamente a seconda della scheda", () => {
  // Terza colonna: in Tosiani è il totale della tabella di riparto e va
  // scartata, in Contavalli è il totale della voce. Stessi numeri, stesso
  // motore, schede diverse.
  const comune = [
    riga(650, [testo(31, "Consumi Acqua")]),
    riga(640, [testo(59, "movimento"), importo(304, "-468,18"), importo(409, "-977,38")]),
  ];

  const perContavalli = leggi([{ numero: 1, righe: [riga(700, COLONNE_CONTAVALLI), ...comune] }], CONTAVALLI);
  assert.equal(perContavalli.voci.length, 1);
  // Il formato stampa le uscite col segno meno: la scheda lo dichiara e il
  // motore le raddrizza, così i totali di formati diversi si confrontano.
  assert.equal(perContavalli.voci[0].importo, 977.38);

  // Con la scheda Tosiani la colonna 2 non è un totale di voce: nulla da
  // leggere, e nessun numero inventato.
  const scheda: ProfiloFormato = { ...TOSIANI, voce: { tipo: "intestazione", rientroMassimo: 5 } };
  const perTosiani = leggi([{ numero: 1, righe: [riga(700, COLONNE_CONTAVALLI), ...comune] }], scheda);
  assert.equal(perTosiani.voci.length, 0);
});

test("Tosiani: due colonne di quota, e il totale di tabella resta fuori", () => {
  const pagina: Pagina = {
    numero: 6,
    righe: [
      riga(671, COLONNE_TOSIANI),
      riga(625, [testo(38, "001.001"), testo(72, "Spese Amministrative")]),
      riga(612, [importo(343, "1.250,00"), importo(399, "1.250,00"), importo(455, "5.395,93")]),
      riga(600, [testo(38, "002.002"), testo(72, "Pulizie")]),
      riga(590, [importo(511, "2.053,26")]),
    ],
  };

  const lettura = leggi([pagina], TOSIANI);
  assert.equal(lettura.voci.length, 2);
  assert.equal(lettura.voci[0].importo, 1250);
  assert.equal(lettura.voci[1].importoSecondario, 2053.26);
});

test("Tosiani: le spese a contatore vengono raccolte a parte", () => {
  const pagina: Pagina = {
    numero: 10,
    righe: [
      riga(671, COLONNE_TOSIANI),
      riga(400, [testo(38, "P01"), testo(72, "Spese Riscaldamento"), importo(399, "7.874,15")]),
      riga(380, [testo(200, "Totale Gen."), importo(399, "7.874,15")]),
    ],
  };

  const lettura = leggi([pagina], TOSIANI);
  assert.equal(lettura.personali.length, 1);
  assert.equal(lettura.personali[0].importo, 7874.15);
  assert.equal(lettura.totaleGenerale, 7874.15);
  assert.equal(lettura.scarto, 0);
});

test("Tosiani: una voce spezzata dal salto pagina resta una sola", () => {
  const pagine: Pagina[] = [
    { numero: 8, righe: [riga(671, COLONNE_TOSIANI), riga(300, [testo(38, "007.001"), testo(72, "Antincendio")])] },
    {
      numero: 9,
      righe: [
        riga(671, COLONNE_TOSIANI),
        riga(600, [testo(38, "007.001"), testo(72, "Antincendio")]),
        riga(580, [importo(511, "986,96")]),
      ],
    },
  ];

  const lettura = leggi(pagine, TOSIANI);
  assert.equal(lettura.voci.length, 1);
  assert.equal(lettura.voci[0].importoSecondario, 986.96);
  assert.equal(lettura.voci[0].pagina, 9);
});

test("MULTIGEST: dopo il totale comincia il preventivo, e non si legge", () => {
  const pagine: Pagina[] = [
    {
      numero: 1,
      righe: [
        riga(700, [testo(30, "CONTO N.14 - ACQUA FREDDA")]),
        riga(690, [testo(30, "Tot. Conto n.14 € 2.465,27")]),
        riga(680, [testo(30, "TOTALE SPESE al 31/07/2021 € 2.465,27")]),
        riga(670, [testo(30, "CONTO N.14 - ACQUA FREDDA")]),
        riga(660, [testo(30, "Tot. Conto n.14 € 2.600,00")]),
      ],
    },
  ];

  const lettura = leggi(pagine, MULTIGEST);
  assert.equal(lettura.voci.length, 1);
  assert.equal(lettura.voci[0].descrizione, "ACQUA FREDDA");
  assert.equal(lettura.scarto, 0);
});

test("Contavalli: la continuazione di un movimento non diventa una voce", () => {
  const pagina: Pagina = {
    numero: 8,
    righe: [
      riga(700, COLONNE_CONTAVALLI),
      riga(650, [testo(31, "Consumi Acqua")]),
      riga(640, [testo(59, "· 01/06/20 - HERA S.p.A.")]),
      riga(635, [testo(59, "13/05/2020 (mc 153) - Ft. n. ... 026")]),
      riga(630, [importo(409, "-977,38")]),
    ],
  };

  const lettura = leggi([pagina], CONTAVALLI);
  assert.equal(lettura.voci.length, 1);
  assert.equal(lettura.voci[0].descrizione, "Consumi Acqua");
});
