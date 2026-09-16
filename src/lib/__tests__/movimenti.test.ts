import assert from "node:assert/strict";
import { test } from "node:test";

import { righeMovimenti } from "../movimenti.ts";
import {
  SENZA_FORNITORE,
  chiaveFornitore,
  indiceFornitori,
  nomeLeggibile,
  perFornitore,
} from "../fornitori.ts";
import type { ExtractedMovimento, Fornitore, Movimento } from "../types.ts";

const CATEGORIE = { riscaldamento: "Riscaldamento", ascensore: "Ascensore", varie: "Varie" };

function movimento(campi: Partial<Movimento>): Movimento {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: "",
    condominium_id: "c",
    anno: 2024,
    data: null,
    descrizione: "",
    fornitore: null,
    categoria: "varie",
    importo: 0,
    fonte_documento: null,
    fonte_pagina: null,
    fonte_testo: null,
    fonte_verificata: false,
    fonte_verificabile: false,
    fornitore_id: null,
    documento_path: null,
    ...campi,
  };
}

// "Otis Servizi S.r.l." e "OTIS SERVIZI SRL" sono la stessa ditta: senza
// normalizzazione la pagina la mostrerebbe due volte con due totali parziali.
test("le forme societarie non spezzano un fornitore in due", () => {
  assert.equal(chiaveFornitore("Otis Servizi S.r.l."), chiaveFornitore("OTIS SERVIZI SRL"));
  assert.equal(chiaveFornitore("Hera S.p.A."), chiaveFornitore("HERA Spa"));
  assert.notEqual(chiaveFornitore("Hera"), chiaveFornitore("Hercules"));
});

test("il nome mostrato resta leggibile, la chiave di confronto no", () => {
  assert.equal(nomeLeggibile("UnipolSai Assicurazioni S.p.A."), "UnipolSai Assicurazioni SPA");
  assert.equal(nomeLeggibile("  Hera   Spa.  "), "Hera SPA");
  assert.equal(nomeLeggibile(null), "");
});

// Gli alias sono il motivo per cui esiste l'anagrafica: una correzione fatta a
// mano deve reggere alla rianalisi successiva, che rilegge il nome dal testo.
test("un alias fa riconoscere il fornitore anche scritto diversamente", () => {
  const anagrafica: Fornitore[] = [
    {
      id: "f1",
      created_at: "",
      condominium_id: "c",
      nome: "Hera",
      alias: ["Hera acqua", "HERA GAS SPA"],
      piva: null,
      note: null,
    },
  ];

  const indice = indiceFornitori(anagrafica);
  assert.equal(indice.get(chiaveFornitore("hera gas s.p.a."))?.id, "f1");
  assert.equal(indice.get(chiaveFornitore("Hera Acqua"))?.id, "f1");
  assert.equal(indice.get(chiaveFornitore("Enel")), undefined);
});

test("una riga senza fornitore finisce in una voce dichiarata, non sparisce", () => {
  const gruppi = perFornitore([movimento({ fornitore: null, importo: 10 })], []);
  assert.equal(gruppi[0].nome, SENZA_FORNITORE);
  assert.equal(gruppi[0].attribuito, false);
});

test("i movimenti si raggruppano per fornitore, dal più caro", () => {
  const gruppi = perFornitore(
    [
      movimento({ fornitore: "Otis Servizi S.r.l.", categoria: "ascensore", importo: 1553.11 }),
      movimento({ fornitore: "OTIS SERVIZI SRL", categoria: "ascensore", importo: 788.24 }),
      movimento({ fornitore: "Hera SPA", categoria: "riscaldamento", importo: 6986.56 }),
      movimento({ fornitore: null, categoria: "varie", importo: 47.82 }),
    ],
    []
  );

  assert.deepEqual(
    gruppi.map((g) => g.nome),
    ["Hera SPA", "Otis Servizi SRL", SENZA_FORNITORE]
  );
  assert.equal(gruppi[1].totale, 2341.35, "due scritture della stessa ditta fanno un totale solo");
  assert.equal(gruppi[1].movimenti.length, 2);
});

// Il collegamento all'anagrafica vince sul testo: è così che un accorpamento
// fatto a mano tiene insieme righe scritte in modi diversi.
test("i movimenti collegati all'anagrafica seguono il nome canonico", () => {
  const anagrafica: Fornitore[] = [
    { id: "f1", created_at: "", condominium_id: "c", nome: "Hera", alias: [], piva: null, note: null },
  ];
  const gruppi = perFornitore(
    [
      movimento({ fornitore: "Hera acqua", fornitore_id: "f1", importo: 2422.38 }),
      movimento({ fornitore: "HERA GAS SPA", fornitore_id: "f1", importo: 6986.56 }),
    ],
    anagrafica
  );

  assert.equal(gruppi.length, 1);
  assert.equal(gruppi[0].nome, "Hera");
  assert.equal(gruppi[0].totale, 9408.94);
});

test("un fornitore che ricorre su più categorie le elenca tutte", () => {
  const gruppi = perFornitore(
    [
      movimento({ fornitore: "Hera SPA", categoria: "riscaldamento", importo: 100 }),
      movimento({ fornitore: "Hera SPA", categoria: "varie", importo: 50, anno: 2023 }),
    ],
    []
  );
  assert.deepEqual(gruppi[0].categorie, ["riscaldamento", "varie"]);
  assert.deepEqual(gruppi[0].anni, [2024, 2023]);
});

// Le righe arrivano dal client: categoria fuori elenco, date inventate e
// importi non numerici non devono entrare nel database così come sono.
test("le righe in arrivo vengono ripulite prima dell'inserimento", () => {
  const estratti = [
    {
      data: "2025-06-26",
      descrizione: " Intervento fognario ",
      fornitore: "S.G Service snc",
      categoria: "fantasia",
      importo: 880,
      fonte: { documento: "r.pdf", pagina: 6, testo: "006.002 ...", verificata: true, verificabile: true },
    },
    { data: "26/06/2025", descrizione: "x", fornitore: "", categoria: "ascensore", importo: 10, fonte: null },
    { data: "", descrizione: "riga vuota", fornitore: "", categoria: "varie", importo: 0, fonte: null },
  ] as unknown as ExtractedMovimento[];

  const righe = righeMovimenti("cond-1", 2024, estratti, CATEGORIE, () => "documenti/r.pdf");

  assert.equal(righe.length, 2, "la riga con importo zero non viene salvata");
  assert.equal(righe[0].categoria, "varie", "una categoria fuori elenco ricade in varie");
  assert.equal(righe[0].descrizione, "Intervento fognario");
  assert.equal(righe[0].data, "2025-06-26");
  assert.equal(righe[0].documento_path, "documenti/r.pdf");
  assert.equal(righe[0].fonte_verificata, true);
  assert.equal(righe[1].data, null, "una data non ISO viene scartata invece di essere indovinata");
  assert.equal(righe[1].fornitore, null);
});
