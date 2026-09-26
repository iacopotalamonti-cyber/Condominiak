// I formati conosciuti, come dati.
//
// Ogni scheda descrive dove guardare in un rendiconto: niente qui esegue
// qualcosa, e nessuna di queste righe può fare più di quanto il motore
// permetta. È la differenza che rende accettabile, domani, far proporre una
// scheda al modello per un formato mai visto.

import type { ProfiloFormato } from "./motore.ts";

// Studio Tosiani. Voci numerate, sei colonne di importi: le prime tre per la
// quota del proprietario, le altre per quella del conduttore. Il totale di una
// voce sta nella colonna "Parziale"; la colonna "Totale" accanto è il totale
// della tabella di riparto, e sommarla conterebbe le spese due volte.
export const TOSIANI: ProfiloFormato = {
  nome: "Studio Tosiani",
  impronta: "Elenco voci di spesa",
  colonnaTotale: 1,
  colonnaTotaleSecondaria: 3,
  voce: { tipo: "codice", schema: "^\\d{3}\\.\\d{3}$" },
  // Le righe dei movimenti hanno quattro colonne: chi, numero di documento,
  // data, importo. È l'unico dei tre formati in cui il fornitore sta da solo.
  fornitore: { tipo: "prima-del-numero" },
  totaleGenerale: "Totale\\s+Gen\\.\\s*([\\d.]+,\\d{2})",
  personali: "^P\\d{2}$",
  unisciVociSpezzate: true,
};

// Studio Contavalli. Nessun codice: le voci sono intestazioni al margine
// sinistro, e il loro totale sta nella terza colonna — la stessa che in
// Tosiani andava scartata. Gli importi sono negativi, perché il documento li
// espone come uscite di cassa.
export const CONTAVALLI: ProfiloFormato = {
  nome: "Studio Contavalli",
  impronta: "Bilancio dettagliato per conto",
  colonnaTotale: 2,
  voce: { tipo: "intestazione", rientroMassimo: 5 },
  segno: -1,
  totaleGenerale: "^TOTALE\\s+(-?[\\d.]+,\\d{2})$",
  // "· 18/06/20 - (G12) - HERA comm S.p.A. - Consumi 02/03/2020 al": data,
  // protocollo, poi la controparte fino al trattino successivo. Senza un
  // secondo trattino ("· 13/02/20 - (G1) - Duplicato chiavi") è solo una
  // descrizione, e la riga resta senza fornitore.
  fornitore: {
    tipo: "in-testa",
    prima: "^·?\\s*\\d{1,2}/\\d{1,2}/\\d{2,4}\\s+-\\s+\\([A-Z]+\\d+\\)\\s+-\\s+",
    fine: "\\s+-\\s",
    fineObbligatoria: true,
    data: "^·?\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4})",
  },
};

// MULTIGEST. Nessuna colonna: gli importi seguono il testo dopo un "€", e ogni
// conto chiude dichiarando il proprio totale. Il file contiene il consuntivo e
// poi il preventivo deliberato, quindi la lettura si ferma al totale.
export const MULTIGEST: ProfiloFormato = {
  nome: "MULTIGEST",
  impronta: "Tot\\.\\s*Conto\\s*n\\.\\s*\\d+\\s*€",
  voce: {
    tipo: "chiusura",
    schema: "Tot\\.\\s*Conto\\s*n\\.\\s*(\\d+)\\s*€\\s*(-?[\\d.]+,\\d{2})",
    nomi: "CONTO\\s+N\\.\\s*(\\d+)\\s*-\\s*(.+?)\\s*$",
  },
  totaleGenerale: "TOTALE\\s+SPESE[^€]*€\\s*(-?[\\d.]+,\\d{2})",
  fermatiAlTotale: true,
  // Fra l'intestazione di un conto e il suo totale, una riga per spesa:
  // "186-COMUNE DI BOLOGNA - passo carraio 25423 anno 2022. € 185,34", a volte
  // su più righe. Il numero di registrazione apre, l'importo chiude.
  righeMovimento: {
    apertura: "^\\d+-",
    importo: "€\\s*(-?[\\d.]+,\\d{2})\\s*$",
    ignora: "^Stabile\\b|\\bPag\\.\\s*\\d+\\s*$",
  },
  // Il nome finisce dove comincia il documento ("ft", "proforma", "del
  // 03/09/2021"), una parentesi, un trattino, o subito dopo la forma
  // societaria ("UnipolSai Assicurazioni S.p.A Globale fabbricati…").
  // "190--imposte di bollo" è una riga in più della banca della riga prima.
  fornitore: {
    tipo: "in-testa",
    prima: "^\\d+-(?!-)",
    fine:
      "(?<=\\b(?:s\\.?p\\.?a|s\\.?r\\.?l|s\\.?n\\.?c|s\\.?a\\.?s)\\.?)\\s|\\s+(?:ft|fatt|proforma|periodo)\\b|\\s*\\(|\\s+-\\s|\\s+del\\s+\\d|\\.\\s*$",
    eredita: "^\\d+--",
    data: "\\bdel\\s*(\\d{1,2}/\\d{1,2}/\\d{4})",
  },
};

export const PROFILI: ProfiloFormato[] = [CONTAVALLI, MULTIGEST, TOSIANI];
