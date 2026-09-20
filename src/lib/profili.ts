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
  totaleGenerale: "^TOTALE\\s+(-?[\\d.]+,\\d{2})$",
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
};

export const PROFILI: ProfiloFormato[] = [CONTAVALLI, MULTIGEST, TOSIANI];
