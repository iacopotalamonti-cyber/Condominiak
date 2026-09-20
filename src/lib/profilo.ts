// Il profilo di un formato: a quale categoria appartiene ogni codice di voce.
//
// È la sola parte che cambia da un amministratore all'altro, ed è anche la sola
// che richieda un giudizio invece di una lettura. Scritta una volta sul primo
// rendiconto di un amministratore, vale per tutti i suoi rendiconti successivi:
// i codici restano gli stessi anno dopo anno. Sui tre esercizi di Via Enriques
// 3, ventidue codici su trenta compaiono in tutti e tre.
//
// Qui non si indovina dalle parole: ogni riga di questa tabella è stata letta
// nel documento per intero, descrizione e fornitore. "Manutenzioni generali
// impianto" da solo non dice quale impianto — la riga sotto dice "ascensore".

import type { Lettura, VoceLetta } from "./motore.ts";

export type Categoria =
  | "riscaldamento"
  | "ascensore"
  | "pulizia"
  | "assicurazione"
  | "amm"
  | "illuminazione"
  | "manutenzione"
  | "acqua"
  | "giardinaggio"
  | "fotovoltaico"
  | "varie";

/**
 * Un incasso non è una spesa col segno meno.
 *
 * Il rimborso di un sinistro assicurativo è denaro che entra: sommarlo alle
 * spese renderebbe l'assicurazione negativa e gli anni non più confrontabili.
 * Sta a parte, e l'app lo mostrerà dove si mostrano le entrate.
 */
export const RIMBORSO = "rimborso" as const;

export type Destinazione = Categoria | typeof RIMBORSO;

export interface Profilo {
  nome: string;
  /** Codice della voce di spesa → dove finisce. */
  voci: Record<string, Destinazione>;
  /** Codice delle spese personali (P00, P01…) → dove finisce. */
  personali: Record<string, Destinazione>;
}

export const PROFILO_ENRIQUES_3: Profilo = {
  nome: "Tosiani Angelo — Via Enriques 3",

  voci: {
    // Tabella A, millesimi generali: quanto costa amministrare il condominio.
    "001.001": "amm", // compenso amministratore
    "001.002": "amm", // spese postali
    "001.003": "amm", // spese banca
    "001.004": "varie", // spese varie proprietà
    "001.005": "assicurazione", // polizza globale fabbricato
    "001.006": "amm", // oneri fiscali (mod. 770, CU, F24)
    "001.007": "varie", // passo carraio

    // Scale e ascensore.
    "002.001": "illuminazione", // luce scale
    "002.002": "pulizia", // pulizie scale
    "002.003": "ascensore", // energia elettrica ascensore
    "002.004": "ascensore", // canone manutenzione ascensore (Otis)
    "002.005": "ascensore", // verifiche periodiche di legge
    "002.006": "ascensore", // manutenzioni generali impianto ascensore
    "002.007": "ascensore", // SIM del telefono di emergenza in cabina

    // Corsello e autorimesse.
    "003.001": "illuminazione",
    "003.002": "pulizia",
    "003.003": "manutenzione", // cancello carrabile

    // Impianto fotovoltaico: ha una categoria propria perché è un impianto del
    // condominio con costi ricorrenti suoi, e finirebbe altrimenti in "varie"
    // insieme a cose che non c'entrano.
    "004.001": "fotovoltaico", // servizi e assistenza
    "004.002": "fotovoltaico", // accisa e diritto di licenza
    "004.003": "fotovoltaico", // oneri fiscali dell'impianto
    "004.004": "fotovoltaico", // manutenzione straordinaria dell'impianto

    // Manutenzioni dell'edificio.
    "006.001": "manutenzione", // manutenzioni generali
    "006.002": "manutenzione", // impianto fognario
    "006.003": "giardinaggio", // disinfestazioni e trattamento antizanzara
    "007.001": "manutenzione", // impianti antincendio
    "007.002": "manutenzione", // manutenzioni generali escluso posti auto
    "008.001": "manutenzione", // recupero patrimonio, spese detraibili
    "008.002": RIMBORSO, // rimborso assicurativo di un sinistro: è un incasso
    "009.001": "varie", // spese generali conduzione appartamenti

    // Acqua fredda. Consumo e storno si annullano: la spesa viene addebitata a
    // contatore, e ricompare fra le spese personali.
    "300.001": "acqua",
    "300.002": "acqua", // letture contatori e ripartizione
    "300.003": "acqua", // storno delle quote, con il segno meno

    // Riscaldamento, raffrescamento e acqua calda. Stessa meccanica.
    "100.001": "riscaldamento", // energia elettrica centrale
    "100.002": "riscaldamento", // gas
    "100.003": "riscaldamento", // conduzione e manutenzione centrale termica
    "100.004": "riscaldamento", // letture contatori
    "100.005": "riscaldamento", // storno delle quote
  },

  personali: {
    "P00": "varie", // spese personali e rimborsi
    "P01": "riscaldamento",
    // Raffrescamento, acqua calda e acqua fredda insieme: il rendiconto non le
    // separa, e l'app non ha una categoria per il raffrescamento.
    "P02": "acqua",
    "P03": "illuminazione", // consumi Enel box e cantine
  },
};

export interface RigaClassificata {
  codice: string;
  descrizione: string;
  importo: number;
}

export interface Classificazione {
  /** Totale per categoria, comprese le quote a contatore. */
  spese: Partial<Record<Categoria, number>>;
  /** Incassi tenuti fuori dalle spese. */
  rimborsi: RigaClassificata[];
  /** Codici che il profilo non conosce: da guardare, non da indovinare. */
  nonMappate: RigaClassificata[];
  totaleSpese: number;
  totaleRimborsi: number;
}

function importoDiVoce(voce: VoceLetta): number {
  return voce.importo + (voce.importoSecondario ?? 0);
}

/**
 * Assegna a ogni voce letta la sua categoria, secondo il profilo.
 *
 * Le spese addebitate a contatore entrano nelle stesse categorie: il
 * riscaldamento del condominio è la somma di quel che resta nel riparto
 * generale e di quel che viene addebitato a consumo. Nel 2023-2024 il riparto
 * generale si annulla del tutto e resta solo il contatore.
 */
export function classifica(lettura: Lettura, profilo: Profilo): Classificazione {
  const spese: Partial<Record<Categoria, number>> = {};
  const rimborsi: RigaClassificata[] = [];
  const nonMappate: RigaClassificata[] = [];

  const aggiungi = (destinazione: Destinazione | undefined, riga: RigaClassificata) => {
    if (!destinazione) {
      nonMappate.push(riga);
      return;
    }
    if (destinazione === RIMBORSO) {
      rimborsi.push(riga);
      return;
    }
    spese[destinazione] = Math.round(((spese[destinazione] ?? 0) + riga.importo) * 100) / 100;
  };

  for (const voce of lettura.voci) {
    aggiungi(profilo.voci[voce.chiave], {
      codice: voce.chiave,
      descrizione: voce.descrizione,
      importo: importoDiVoce(voce),
    });
  }

  for (const personale of lettura.personali) {
    aggiungi(profilo.personali[personale.chiave], {
      codice: personale.chiave,
      descrizione: personale.descrizione,
      importo: personale.importo,
    });
  }

  const somma = (valori: number[]) => Math.round(valori.reduce((a, b) => a + b, 0) * 100) / 100;

  return {
    spese,
    rimborsi,
    nonMappate,
    totaleSpese: somma(Object.values(spese) as number[]),
    totaleRimborsi: somma(rimborsi.map((r) => r.importo)),
  };
}
