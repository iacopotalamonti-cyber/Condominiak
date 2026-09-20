import { strict as assert } from "node:assert";
import { test } from "node:test";

import { leggiContavalli, leggiMultigest, riconosciDialetto } from "../dialetti.ts";
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

// Le colonne del formato Contavalli: Importo, Parziale sottoconto, Totale.
const COLONNE: Frammento[] = [
  { x: 280, xFine: 304, testo: "Importo" },
  { x: 330, xFine: 353, testo: "Parziale" },
  { x: 390, xFine: 409, testo: "Totale" },
];

test("riconosce i tre formati dalle loro impronte", () => {
  const con = (s: string): Pagina[] => [{ numero: 1, righe: [riga(700, [testo(30, s)])] }];
  assert.equal(riconosciDialetto(con("Bilancio dettagliato per conto")), "contavalli");
  assert.equal(riconosciDialetto(con("Tot. Conto n.9 € 8,98")), "multigest");
  assert.equal(riconosciDialetto(con("Elenco voci di spesa consuntivo")), "tosiani");
});

test("un formato sconosciuto resta sconosciuto, invece di essere forzato", () => {
  const ignoto: Pagina[] = [{ numero: 1, righe: [riga(700, [testo(30, "Rendiconto di qualcun altro")])] }];
  assert.equal(riconosciDialetto(ignoto), null);
});

test("Contavalli: il totale della voce sta nella colonna Totale", () => {
  const pagina: Pagina = {
    numero: 8,
    righe: [
      riga(700, COLONNE),
      riga(650, [testo(31, "Consumi Acqua")]),
      // Movimento rientrato: il suo importo non è il totale della voce.
      riga(640, [testo(59, "· 01/06/20 - HERA"), importo(304, "-468,18")]),
      riga(630, [testo(59, "· 28/07/20 - HERA"), importo(304, "-509,20"), importo(409, "-977,38")]),
    ],
  };

  const lettura = leggiContavalli([pagina]);
  assert.equal(lettura.voci.length, 1);
  assert.equal(lettura.voci[0].descrizione, "Consumi Acqua");
  assert.equal(lettura.voci[0].importo, -977.38);
});

test("Contavalli: la continuazione di un movimento non diventa una voce", () => {
  // È il caso vero: senza la regola del margine, la spesa dell'acqua si
  // chiamava "13/05/2020 (mc 153) - Ft. n. ... 026".
  const pagina: Pagina = {
    numero: 8,
    righe: [
      riga(700, COLONNE),
      riga(650, [testo(31, "Consumi Acqua")]),
      riga(640, [testo(59, "· 01/06/20 - HERA S.p.A. - Consumi stimato")]),
      riga(635, [testo(59, "13/05/2020 (mc 153) - Ft. n. ... 026")]),
      riga(630, [importo(409, "-977,38")]),
    ],
  };

  const lettura = leggiContavalli([pagina]);
  assert.equal(lettura.voci.length, 1);
  assert.equal(lettura.voci[0].descrizione, "Consumi Acqua");
});

test("Contavalli: una voce che ripete il totale in riga Tot. non conta due volte", () => {
  const pagina: Pagina = {
    numero: 10,
    righe: [
      riga(700, COLONNE),
      riga(650, [testo(31, "Elevatore Gestione")]),
      riga(640, [testo(59, "· energia"), importo(304, "10,80"), importo(409, "-306,11")]),
      riga(630, [testo(224, "Tot. Elevatore Gestione"), importo(409, "-306,11")]),
    ],
  };

  const lettura = leggiContavalli([pagina]);
  assert.equal(lettura.voci.length, 1);
  assert.equal(lettura.voci[0].importo, -306.11);
});

test("MULTIGEST: legge i conti e si ferma al totale, escludendo il preventivo", () => {
  // Lo stesso file contiene consuntivo e preventivo deliberato: leggerli
  // entrambi raddoppierebbe la spesa.
  const pagine: Pagina[] = [
    {
      numero: 1,
      righe: [
        riga(700, [testo(30, "CONTO N.9 - IMPIANTO FOTOVOLTAICO")]),
        riga(690, [testo(30, "Tot. Conto n.9 € 8,98")]),
        riga(680, [testo(30, "CONTO N.14 - ACQUA FREDDA")]),
        riga(670, [testo(30, "Tot. Conto n.14 € 2.465,27")]),
        riga(660, [testo(30, "TOTALE SPESE al 31/07/2021 € 2.474,25")]),
        // Da qui comincia il preventivo: non va letto.
        riga(650, [testo(30, "CONTO N.14 - ACQUA FREDDA")]),
        riga(640, [testo(30, "Tot. Conto n.14 € 2.600,00")]),
      ],
    },
  ];

  const lettura = leggiMultigest(pagine);
  assert.equal(lettura.voci.length, 2);
  assert.equal(lettura.voci[1].descrizione, "ACQUA FREDDA");
  assert.equal(lettura.totaleGenerale, 2474.25);
  assert.equal(lettura.scarto, 0);
});
