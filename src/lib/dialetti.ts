// I dialetti: un lettore per ciascun formato di rendiconto.
//
// Tre studi, tre modi di stampare le stesse cose. Non è una questione di
// etichette diverse: cambia dove sta il totale di una voce, e perfino il
// significato delle colonne. In Tosiani la terza colonna è il totale della
// tabella di riparto, da scartare; in Contavalli la terza colonna è il totale
// della voce, da tenere. Un lettore solo che prova a indovinare quale sia
// sbaglia in silenzio — ed è il motivo per cui ogni formato ha il suo.
//
// Tutti e tre condividono però la stessa garanzia: il documento stampa il
// proprio totale, e la lettura si confronta con quello. Un dialetto che non
// quadra è un dialetto che non ha capito il documento, e lo dichiara.

import { colonnaDi, importoDi, mappaColonne, type Pagina, type Riga } from "./rendiconto.ts";

export type NomeDialetto = "tosiani" | "contavalli" | "multigest";

export interface VoceLetta {
  /** Codice se il formato ne ha uno, altrimenti l'intestazione della voce. */
  chiave: string;
  descrizione: string;
  importo: number;
  pagina: number;
}

export interface Lettura {
  dialetto: NomeDialetto;
  voci: VoceLetta[];
  totaleGenerale: number | null;
  /** Differenza fra la somma delle voci e il totale stampato. */
  scarto: number | null;
}

function testo(riga: Riga): string {
  return riga.frammenti
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((f) => f.testo.trim())
    .filter(Boolean)
    .join(" ");
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

function conScarto(dialetto: NomeDialetto, voci: VoceLetta[], totaleGenerale: number | null): Lettura {
  const somma = arrotonda(voci.reduce((tot, v) => tot + v.importo, 0));
  return {
    dialetto,
    voci,
    totaleGenerale,
    scarto: totaleGenerale === null ? null : arrotonda(somma - totaleGenerale),
  };
}

// ---------------------------------------------------------------------------
// Contavalli — "Bilancio dettagliato per conto"
// ---------------------------------------------------------------------------
//
// Le voci non hanno codice: sono intestazioni di testo, e il loro totale sta
// nella colonna "Totale". Alcune lo stampano anche in una riga "Tot. <voce>",
// altre no: prendere entrambe conterebbe due volte la stessa spesa, quindi ogni
// intestazione tiene un solo totale, l'ultimo che incontra. Gli importi sono
// negativi perché il documento li espone come uscite.

const CONTAVALLI_IMPRONTA = /Bilancio dettagliato per conto/i;
const CONTAVALLI_TOTALE = /^TOTALE\s+(-?[\d.]+,\d{2})$/;
const CONTAVALLI_CHIUSURA = /^Tot\.\s+(.+?)\s+-?[\d.]+,\d{2}$/;

// Un'intestazione di voce comincia al margine sinistro; i movimenti e le loro
// righe di continuazione sono rientrati. Senza questa distinzione la seconda
// riga di un movimento — "13/05/2020 (mc 153) - Ft. n. ... 026" — verrebbe
// scambiata per il nome di una voce, e la spesa dell'acqua si chiamerebbe così.
const RIENTRO_MASSIMO = 5;

export function leggiContavalli(pagine: Pagina[]): Lettura {
  const voci: VoceLetta[] = [];
  let totaleGenerale: number | null = null;
  let corrente: VoceLetta | null = null;

  for (const pagina of pagine) {
    const mappa = mappaColonne(pagina.righe.flatMap((r) => r.frammenti));
    if (!mappa) continue;

    const margine = Math.min(...pagina.righe.flatMap((r) => r.frammenti.map((f) => f.x)));

    for (const riga of pagina.righe.slice().sort((a, b) => b.y - a.y)) {
      const linea = testo(riga);

      const finale = linea.match(CONTAVALLI_TOTALE);
      if (finale) {
        totaleGenerale = importoDi(finale[1]);
        continue;
      }

      const importi = riga.frammenti.filter((f) => importoDi(f.testo) !== null);

      // Una riga di solo testo, al margine sinistro, apre una voce nuova.
      if (!importi.length) {
        const inizio = Math.min(...riga.frammenti.map((f) => f.x));
        const intestazione = inizio <= margine + RIENTRO_MASSIMO && !linea.startsWith("·");
        if (intestazione && linea.length > 2) {
          corrente = { chiave: linea, descrizione: linea, importo: 0, pagina: pagina.numero };
        }
        continue;
      }

      const chiusura = linea.match(CONTAVALLI_CHIUSURA);
      if (chiusura && corrente?.chiave !== chiusura[1]) {
        corrente = { chiave: chiusura[1], descrizione: chiusura[1], importo: 0, pagina: pagina.numero };
      }

      for (const frammento of importi) {
        // Solo la colonna del totale di voce: le altre sono l'importo del
        // singolo movimento e il parziale del sottoconto.
        if (colonnaDi(frammento.xFine, mappa) !== "totale_proprietario") continue;
        if (!corrente) continue;

        // L'ultimo totale sotto un'intestazione è quello della voce: se il
        // documento lo ripete nella riga "Tot.", è lo stesso numero.
        corrente.importo = importoDi(frammento.testo)!;
        corrente.pagina = pagina.numero;
        if (!voci.includes(corrente)) voci.push(corrente);
      }
    }
  }

  return conScarto("contavalli", voci.filter((v) => v.importo !== 0), totaleGenerale);
}

// ---------------------------------------------------------------------------
// MULTIGEST — conti numerati, importi in linea
// ---------------------------------------------------------------------------
//
// Nessuna colonna: gli importi seguono il testo preceduti da "€". Le voci sono
// i conti, e ciascuno chiude con "Tot. Conto n.X € importo".
//
// Attenzione: lo stesso file contiene il consuntivo e, di seguito, il
// preventivo deliberato. Leggerli entrambi raddoppierebbe la spesa — sul
// bilancio di Via Enriques fa 45.577,89 invece di 20.857,74. La lettura si
// ferma quindi al totale del consuntivo, che è stampato.

const MULTIGEST_IMPRONTA = /Tot\.\s*Conto\s*n\.\s*\d+\s*€/i;
const MULTIGEST_CONTO = /CONTO\s+N\.\s*(\d+)\s*-\s*(.+?)\s*$/i;
const MULTIGEST_CHIUSURA = /Tot\.\s*Conto\s*n\.\s*(\d+)\s*€\s*(-?[\d.]+,\d{2})/i;
const MULTIGEST_TOTALE = /TOTALE\s+SPESE[^€]*€\s*(-?[\d.]+,\d{2})/i;

export function leggiMultigest(pagine: Pagina[]): Lettura {
  const voci: VoceLetta[] = [];
  let totaleGenerale: number | null = null;
  const nomi = new Map<string, string>();

  for (const pagina of pagine) {
    for (const riga of pagina.righe.slice().sort((a, b) => b.y - a.y)) {
      const linea = testo(riga);

      const conto = linea.match(MULTIGEST_CONTO);
      if (conto) nomi.set(conto[1], conto[2]);

      const chiusura = linea.match(MULTIGEST_CHIUSURA);
      if (chiusura && totaleGenerale === null) {
        const importo = importoDi(chiusura[2]);
        if (importo !== null) {
          voci.push({
            chiave: `conto ${chiusura[1]}`,
            descrizione: nomi.get(chiusura[1]) ?? `Conto ${chiusura[1]}`,
            importo,
            pagina: pagina.numero,
          });
        }
      }

      // Il totale chiude il consuntivo: quello che segue è il preventivo.
      const finale = linea.match(MULTIGEST_TOTALE);
      if (finale && totaleGenerale === null) totaleGenerale = importoDi(finale[1]);
    }
  }

  return conScarto("multigest", voci, totaleGenerale);
}

// ---------------------------------------------------------------------------
// Riconoscimento
// ---------------------------------------------------------------------------

const IMPRONTE: { dialetto: NomeDialetto; impronta: RegExp }[] = [
  { dialetto: "contavalli", impronta: CONTAVALLI_IMPRONTA },
  { dialetto: "multigest", impronta: MULTIGEST_IMPRONTA },
  { dialetto: "tosiani", impronta: /Elenco voci di spesa/i },
];

/**
 * Qual è il formato di questo documento, se lo conosciamo.
 *
 * Null non è un fallimento da nascondere: è l'informazione che serve per
 * decidere di chiamare il modello invece di leggere numeri a caso.
 */
export function riconosciDialetto(pagine: Pagina[]): NomeDialetto | null {
  const testoIntero = pagine
    .flatMap((p) => p.righe.map(testo))
    .join("\n");

  for (const { dialetto, impronta } of IMPRONTE) {
    if (impronta.test(testoIntero)) return dialetto;
  }
  return null;
}
