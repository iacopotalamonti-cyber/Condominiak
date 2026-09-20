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
import type { CategoriaSpesa } from "./types.ts";

// Le categorie sono quelle dell'applicazione, non un secondo elenco parallelo:
// una categoria che esiste qui e non lì produrrebbe righe che l'app salva e
// non sa più mostrare.
export type Categoria = CategoriaSpesa;

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

// ---------------------------------------------------------------------------
// Studio Contavalli
// ---------------------------------------------------------------------------
//
// Le voci di questo formato sono più grosse delle categorie dell'app, e non si
// può rimediare mappando meglio: "Generali di Proprietà" contiene insieme la
// polizza UnipolSai, il compenso dell'amministratore, le spese bancarie, la
// connessione del fotovoltaico e i lavori dell'impresa edile. Finisce in
// "amm" perché è lì che sta la parte maggiore, ma chi confronta le categorie
// fra il 2019-2020 e gli anni dopo sta confrontando cose di grana diversa.
// Separarle vorrebbe dire scendere al singolo movimento: si può fare, e non
// serve per rispondere alla domanda "quanto spendiamo all'anno".

export const MAPPATURA_CONTAVALLI: Profilo = {
  nome: "Studio Contavalli — Via Enriques 3",
  voci: {
    "Generali di Proprietà": "amm", // polizza, amministratore, banca, fotovoltaico, lavori
    "Generali di Gestione": "amm",
    "Consumi riscaldamento/Raffrescamento": "riscaldamento",
    "Consumi Acqua": "acqua",
    "Pulizia e luce scale": "pulizia",
    "Elevatore Gestione": "ascensore",
    "Corsello autorimesse": "varie",
    "Energia elettrica individuale BOX": "illuminazione",
    // Spesa di un singolo condomino, riaddebitata a lui: non è spesa comune.
    "Spese personali": RIMBORSO,
  },
  personali: {},
};

// ---------------------------------------------------------------------------
// MULTIGEST
// ---------------------------------------------------------------------------
//
// I conti sono numerati e la numerazione regge fra gli anni: gli stessi dieci
// numeri compaiono nel 2020-2021 e nel 2021-2022, anche quando il nome cambia
// ("ASCENSORE" diventa "CONTO ASCENSORE"). Si mappa quindi il numero, che è
// stabile, e non il nome, che non lo è.

export const MAPPATURA_MULTIGEST: Profilo = {
  nome: "MULTIGEST — Via Enriques 3",
  voci: {
    "1": "amm", // Generali
    "2": "pulizia", // pulizia e luce scale insieme: il conto non le separa
    "4": "varie", // corsello autorimesse
    "6": "riscaldamento", // riscaldamento, raffrescamento e ACS
    "9": "fotovoltaico",
    "11": "manutenzione",
    "12": RIMBORSO, // personali: riaddebitate al singolo condomino
    "14": "acqua",
    "15": "ascensore",
    "16": "varie", // posti auto esterni
  },
  personali: {},
};

/** La mappatura da usare per un formato, se la conosciamo. */
export function mappaturaPer(formato: string): Profilo | null {
  if (formato === "Studio Tosiani") return PROFILO_ENRIQUES_3;
  if (formato === "Studio Contavalli") return MAPPATURA_CONTAVALLI;
  if (formato === "MULTIGEST") return MAPPATURA_MULTIGEST;
  return null;
}
