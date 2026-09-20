import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  classifica,
  mappaturaPer,
  MAPPATURA_CONTAVALLI,
  MAPPATURA_MULTIGEST,
  PROFILO_ENRIQUES_3,
  RIMBORSO,
} from "../profilo.ts";
import type { Lettura, VoceLetta } from "../motore.ts";

function voce(chiave: string, importo: number, secondario = false): VoceLetta {
  return {
    chiave,
    descrizione: chiave,
    importo: secondario ? 0 : importo,
    importoSecondario: secondario ? importo : null,
    pagina: 1,
  };
}

function lettura(voci: VoceLetta[], personali: Lettura["personali"] = []): Lettura {
  return { profilo: "prova", voci, personali, totaleGenerale: null, scarto: null };
}

test("un rimborso assicurativo non abbassa la categoria assicurazione", () => {
  const voci = [voce("001.005", 1981.9), voce("008.002", -2500)];
  const esito = classifica(lettura(voci), PROFILO_ENRIQUES_3);

  assert.equal(esito.spese.assicurazione, 1981.9);
  assert.equal(esito.rimborsi.length, 1);
  assert.equal(esito.totaleRimborsi, -2500);
  assert.equal(PROFILO_ENRIQUES_3.voci["008.002"], RIMBORSO);
});

test("consumo e storno si annullano, e resta la quota a contatore", () => {
  // È il caso del riscaldamento: tutto il costo viene girato ai contatori, e
  // ricompare fra le spese personali.
  const voci = [voce("100.002", 3728.72, true), voce("100.005", -3728.72, true)];
  const esito = classifica(
    lettura(voci, [{ chiave: "P01", descrizione: "Spese Riscaldamento", importo: 6037.44 }]),
    PROFILO_ENRIQUES_3
  );
  assert.equal(esito.spese.riscaldamento, 6037.44);
});

test("la manutenzione straordinaria del fotovoltaico non è manutenzione", () => {
  // 004.004 si chiama "Interventi di manutenzione" e prosegue a capo con
  // "straordinaria impianto fotovoltaico": sono 5.378,85 che cambiano
  // categoria a seconda di quanto si è letto.
  const esito = classifica(lettura([voce("004.004", 5378.85, true)]), PROFILO_ENRIQUES_3);
  assert.equal(esito.spese.fotovoltaico, 5378.85);
  assert.equal(esito.spese.manutenzione, undefined);
});

test("un codice che il profilo non conosce resta fuori, dichiarato", () => {
  const esito = classifica(lettura([voce("999.999", 100)]), PROFILO_ENRIQUES_3);
  assert.equal(esito.nonMappate.length, 1);
  assert.equal(esito.nonMappate[0].codice, "999.999");
  assert.equal(esito.totaleSpese, 0);
});

test("le categorie dell'esercizio 2023-2024 sommano al totale del documento", () => {
  // I numeri sono quelli letti dal rendiconto vero: 30.793,26 di spese meno
  // 2.500,00 di rimborso fanno il Totale Gen. stampato, 28.293,26.
  const voci: VoceLetta[] = [
    voce("001.001", 1586.0), voce("001.002", 47.82), voce("001.003", 373.71),
    voce("001.004", 455.32), voce("001.005", 1981.9), voce("001.006", 795.57),
    voce("001.007", 185.0), voce("002.001", 307.33, true), voce("002.002", 2239.92, true),
    voce("002.003", 1229.37, true), voce("002.004", 1505.32, true), voce("002.007", 735.22, true),
    voce("003.001", 102.46, true), voce("003.002", 248.88, true), voce("008.002", -2500.0),
    voce("004.001", 603.14, true), voce("004.002", 23.27, true), voce("004.003", 83.33, true),
    voce("004.004", 5378.85, true), voce("007.001", 986.96, true), voce("007.002", 814.9, true),
    voce("300.001", 2076.33, true), voce("300.003", -2076.33, true),
    voce("100.001", 2458.73, true), voce("100.002", 3728.72, true), voce("100.003", 2374.95, true),
    voce("100.004", 329.4, true), voce("100.005", -8891.8, true),
  ];
  const esito = classifica(
    lettura(voci, [
      { chiave: "P00", descrizione: "Spese personali e rimborsi", importo: 44.41 },
      { chiave: "P01", descrizione: "Spese Riscaldamento", importo: 6037.44 },
      { chiave: "P02", descrizione: "Spese Raffr. - ACS - AFS", importo: 4967.03 },
      { chiave: "P03", descrizione: "Consumi Enel Box/Cantine", importo: 60.11 },
    ]),
    PROFILO_ENRIQUES_3
  );

  assert.equal(esito.nonMappate.length, 0);
  assert.equal(esito.totaleSpese, 30793.26);
  assert.equal(esito.totaleRimborsi, -2500);
  assert.equal(Math.round((esito.totaleSpese + esito.totaleRimborsi) * 100) / 100, 28293.26);

  assert.equal(esito.spese.fotovoltaico, 6088.59);
  assert.equal(esito.spese.riscaldamento, 6037.44);
  assert.equal(esito.spese.acqua, 4967.03);
  assert.equal(esito.spese.manutenzione, 1801.86);
});

test("ogni formato conosciuto ha la sua mappatura, gli altri no", () => {
  assert.ok(mappaturaPer("Studio Tosiani"));
  assert.ok(mappaturaPer("Studio Contavalli"));
  assert.ok(mappaturaPer("MULTIGEST"));
  assert.equal(mappaturaPer("Studio di qualcun altro"), null);
});

test("Contavalli: le categorie sommano al totale stampato del 2019-2020", () => {
  // Voci vere, già raddrizzate di segno dal motore. La spesa personale di un
  // singolo condomino resta fuori: 12.425,35 meno 31,30 fa 12.394,05.
  const voci = [
    voce("Generali di Proprietà", 6406.56), voce("Generali di Gestione", 206.51),
    voce("Consumi riscaldamento/Raffrescamento", 3112.99), voce("Consumi Acqua", 977.38),
    voce("Pulizia e luce scale", 922.11), voce("Elevatore Gestione", 306.11),
    voce("Corsello autorimesse", 457.69), voce("Energia elettrica individuale BOX", 36.0),
    voce("Spese personali", -31.3),
  ];

  const esito = classifica(lettura(voci), MAPPATURA_CONTAVALLI);
  assert.equal(esito.nonMappate.length, 0);
  assert.equal(esito.totaleSpese, 12425.35);
  assert.equal(Math.round((esito.totaleSpese + esito.totaleRimborsi) * 100) / 100, 12394.05);
  // "Generali di Proprietà" tiene dentro polizza, amministratore e banca: la
  // categoria è più grossa di quella degli anni successivi, e si vede.
  assert.equal(esito.spese.amm, 6613.07);
});

test("MULTIGEST: si mappa il numero del conto, che resta uguale fra gli anni", () => {
  const voci = [
    voce("1", 8452.0), voce("2", 2870.86), voce("4", 790.19), voce("6", 11666.47),
    voce("9", 23.24), voce("11", 1143.96), voce("12", 98.0), voce("14", 2344.49),
    voce("15", 4732.11), voce("16", 123.56),
  ];

  const esito = classifica(lettura(voci), MAPPATURA_MULTIGEST);
  assert.equal(esito.nonMappate.length, 0);
  assert.equal(esito.totaleSpese, 32146.88);
  assert.equal(esito.totaleRimborsi, 98);
  assert.equal(Math.round((esito.totaleSpese + esito.totaleRimborsi) * 100) / 100, 32244.88);
  assert.equal(esito.spese.riscaldamento, 11666.47);
});
