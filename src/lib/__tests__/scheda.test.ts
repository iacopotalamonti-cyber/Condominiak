import { strict as assert } from "node:assert";
import { test } from "node:test";

import { leggiRendiconto } from "../lettura.ts";
import { PROFILI } from "../profili.ts";
import { proponiScheda } from "../proposta-scheda.ts";
import type { Frammento, Pagina } from "../rendiconto.ts";
import { motivoEspressione, validaProposta, verificaProposta, type Proposta } from "../scheda.ts";

// Un formato che il codice non conosce: colonne intestate "Dare", "Voce" e
// "Tabella", codici come "A.01", e accanto al totale della voce il totale
// della tabella di riparto — la colonna sbagliata da prendere.
const t = (x: number, s: string): Frammento => ({ x, xFine: x + s.length * 5, testo: s });
const n = (xFine: number, s: string): Frammento => ({ x: xFine - 40, xFine, testo: s });
const riga = (y: number, ...frammenti: Frammento[]) => ({ y, frammenti });

const ROSSI: Pagina[] = [
  {
    numero: 1,
    righe: [
      riga(800, t(30, "Gestionale CondoRossi — Rendiconto di gestione 01/09/2024 - 31/08/2025")),
      riga(760, t(300, "Dare"), t(380, "Voce"), t(450, "Tabella")),
      riga(740, t(30, "A.01"), t(70, "Compenso amministratore")),
      riga(730, t(70, "Studio Rossi fattura 12"), n(325, "600,00")),
      riga(720, t(70, "Studio Rossi fattura 31"), n(325, "400,00"), n(405, "1.000,00"), n(485, "1.500,00")),
      riga(700, t(30, "B.02"), t(70, "Pulizia scale")),
      riga(690, t(70, "Pulisci srl"), n(325, "500,00"), n(405, "500,00"), n(485, "1.500,00")),
      riga(660, t(30, "Totale spese 1.500,00")),
    ],
  },
];

const GIUSTA = {
  scheda: {
    nome: "CondoRossi",
    impronta: "Gestionale CondoRossi",
    intestazioni: { movimento: "^Dare$", totali: "^(Voce|Tabella)$" },
    colonnaTotale: 1,
    voce: { tipo: "codice", schema: "^[A-Z]\\.\\d{2}$" },
    totaleGenerale: "Totale spese\\s+([\\d.]+,\\d{2})",
  },
  mappatura: { voci: { "A.01": "amm", "B.02": "pulizia" } },
};

const RISERVATI = PROFILI.map((p) => p.nome);
const valida = (input: unknown): Proposta => {
  const esito = validaProposta(input, RISERVATI);
  assert.deepEqual(esito.errori, []);
  return esito.proposta!;
};

test("una scheda giusta quadra da sola sul documento da cui è nata", () => {
  const verifica = verificaProposta(ROSSI, valida(GIUSTA));
  assert.equal(verifica.motivo, null);
  assert.equal(verifica.utilizzabile, true);
  assert.equal(verifica.anno, 2025);
  assert.equal(verifica.totaleStampato, 1500);
  assert.equal(verifica.scarto, 0);
  assert.deepEqual(
    verifica.voci.map((v) => [v.chiave, v.importo, v.categoria]),
    [
      ["A.01", 1000, "amm"],
      ["B.02", 500, "pulizia"],
    ]
  );
});

test("la colonna sbagliata non passa: la quadratura se ne accorge", () => {
  const verifica = verificaProposta(ROSSI, valida({ ...GIUSTA, scheda: { ...GIUSTA.scheda, colonnaTotale: 2 } }));
  assert.equal(verifica.utilizzabile, false);
  assert.match(verifica.motivo ?? "", /non tornano con il totale stampato/);
});

test("una voce senza categoria non passa", () => {
  const verifica = verificaProposta(ROSSI, valida({ ...GIUSTA, mappatura: { voci: { "A.01": "amm" } } }));
  assert.equal(verifica.utilizzabile, false);
  assert.match(verifica.motivo ?? "", /B\.02/);
});

test("l'impronta deve comparire nel documento", () => {
  const verifica = verificaProposta(ROSSI, valida({ ...GIUSTA, scheda: { ...GIUSTA.scheda, impronta: "Gestionale Bianchi" } }));
  assert.match(verifica.motivo ?? "", /impronta/);
});

test("la forma: solo ciò che il motore sa eseguire", () => {
  const errori = (modifica: Record<string, unknown>, mappatura: unknown = GIUSTA.mappatura) =>
    validaProposta({ scheda: { ...GIUSTA.scheda, ...modifica }, mappatura }, RISERVATI).errori.join("; ");

  assert.match(errori({ esegui: "rm -rf" }), /campo sconosciuto "esegui"/);
  assert.match(errori({ nome: "Studio Tosiani" }), /esiste già/);
  assert.match(errori({ impronta: "Totale" }), /troppo generica/);
  assert.match(errori({ totaleGenerale: "Totale spese" }), /gruppi di cattura/);
  assert.match(errori({ colonnaTotale: 9 }), /fra 0 e 6/);
  assert.match(errori({ voce: { tipo: "script", corpo: "x" } }), /non è codice/);
  assert.match(errori({}, { voci: { "A.01": "bollette" } }), /non è una categoria/);
  assert.match(validaProposta("non json", RISERVATI).errori.join(), /due oggetti/);
});

test("le espressioni che potrebbero bloccare la lettura si rifiutano", () => {
  assert.equal(motivoEspressione("Totale\\s+Gen\\.\\s*([\\d.]+,\\d{2})"), null);
  assert.equal(motivoEspressione("CONTO\\s+N\\.\\s*(\\d+)\\s*-\\s*(.+?)\\s*$"), null);
  assert.equal(motivoEspressione("(a+)+$"), "quantificatori annidati");
  assert.equal(motivoEspressione("(\\d*,)*x"), "quantificatori annidati");
  assert.equal(motivoEspressione("(x)\\1"), "riferimenti all'indietro");
  assert.equal(motivoEspressione("(non chiusa"), "non si compila");
  assert.equal(motivoEspressione("a".repeat(201)), "più lunga di 200 caratteri");
});

test("il modello sbaglia colonna, riceve il motivo, e corregge", async () => {
  const conversazioni: string[][] = [];
  const risposte = [
    JSON.stringify({ ...GIUSTA, scheda: { ...GIUSTA.scheda, colonnaTotale: 2 } }),
    `Ecco la scheda corretta:\n${JSON.stringify(GIUSTA)}`,
  ];
  const esito = await proponiScheda(
    ROSSI,
    async (conversazione) => {
      conversazioni.push([...conversazione]);
      return risposte[conversazioni.length - 1];
    },
    RISERVATI
  );

  assert.equal(esito.tentativi, 2);
  assert.equal(esito.verifica?.utilizzabile, true);
  assert.equal(esito.proposta?.scheda.colonnaTotale, 1);
  // Il documento arriva con le coordinate, e la correzione con ciò che il
  // motore ha letto.
  assert.match(conversazioni[0][0], /\[30-\d+\] A\.01/);
  assert.match(conversazioni[1][2], /non tornano con il totale stampato/);
  assert.match(conversazioni[1][2], /A\.01 \| Compenso amministratore \| 1500/);
});

test("dopo due tentativi non si insiste", async () => {
  let chiamate = 0;
  const esito = await proponiScheda(ROSSI, async () => (chiamate++, "non ho capito"), RISERVATI);
  assert.equal(chiamate, 2);
  assert.equal(esito.proposta, null);
  assert.match(esito.problemi.join(), /due oggetti/);
});

test("una scheda approvata si usa come quelle scritte a mano, ma non le scavalca", () => {
  const proposta = valida(GIUSTA);
  assert.equal(leggiRendiconto(ROSSI), null);
  const letto = leggiRendiconto(ROSSI, [proposta]);
  assert.equal(letto?.formato, "CondoRossi");
  assert.equal(letto?.motivo, null);
  assert.deepEqual(letto?.classificazione.spese, { amm: 1000, pulizia: 500 });

  // Un'impronta che compare anche in un documento Tosiani non lo porta via
  // alla scheda Tosiani.
  const tosiani: Pagina[] = [{ numero: 1, righe: [riga(700, t(30, "Elenco voci di spesa — Gestionale CondoRossi"))] }];
  assert.equal(leggiRendiconto(tosiani, [proposta])?.formato, "Studio Tosiani");
});

test("le tre schede scritte a mano passerebbero la stessa validazione", async () => {
  const { MAPPATURA_CONTAVALLI, MAPPATURA_MULTIGEST, PROFILO_ENRIQUES_3 } = await import("../profilo.ts");
  const mappature = [MAPPATURA_CONTAVALLI, MAPPATURA_MULTIGEST, PROFILO_ENRIQUES_3];
  PROFILI.forEach((scheda, i) => {
    const esito = validaProposta(
      { scheda: { ...scheda, nome: `${scheda.nome} bis` }, mappatura: { voci: mappature[i].voci, personali: mappature[i].personali } },
      RISERVATI
    );
    assert.deepEqual(esito.errori, [], scheda.nome);
  });
});
