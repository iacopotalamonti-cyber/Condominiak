import type { Impianto, Pagamento, Unita, UsoModello } from "@/lib/types";

// La tabella millesimale dovrebbe sommare 1000, ma quella estratta da un
// documento spesso no: unità mancanti, valori letti male, o millesimi che nel
// documento sono davvero parziali. Ripartire su un 1000 teorico quando il
// totale reale è un altro sottostima ogni quota in silenzio — e la somma delle
// quote non copre il consuntivo. Il denominatore è quindi la somma effettiva.
export const MILLESIMI_ATTESI = 1000;

export function sommaMillesimi(unita: Pick<Unita, "millesimi">[]): number {
  return Math.round(unita.reduce((somma, u) => somma + (u.millesimi || 0), 0) * 100) / 100;
}

// Vero quando la tabella millesimale non somma 1000: la ripartizione resta
// corretta fra le unità note, ma qualcosa nei dati manca e va detto.
export function millesimiIncompleti(totale: number): boolean {
  return totale > 0 && Math.abs(totale - MILLESIMI_ATTESI) > 0.5;
}

// Quota mensile di un appartamento
export function quotaMensile(
  millesimi: number,
  consuntivoAnnuo: number,
  totaleMillesimi = MILLESIMI_ATTESI
): number {
  return Math.round(quotaAnnua(millesimi, consuntivoAnnuo, totaleMillesimi) / 12);
}

// Quota annua di un appartamento
export function quotaAnnua(
  millesimi: number,
  consuntivoAnnuo: number,
  totaleMillesimi = MILLESIMI_ATTESI
): number {
  const denominatore = totaleMillesimi > 0 ? totaleMillesimi : MILLESIMI_ATTESI;
  return Math.round((millesimi / denominatore) * consuntivoAnnuo);
}

// Totale morosità per un condominio
export function calcolaMorosita(pagamenti: Pagamento[]): number {
  return pagamenti
    .filter((p) => p.stato === "non_pagato")
    .reduce((sum, p) => sum + (p.importo || 0), 0);
}

// Percentuale di morosità sul totale atteso
export function percentualeMorosita(pagamenti: Pagamento[]): number {
  const totaleAtteso = pagamenti.reduce((sum, p) => sum + (p.importo || 0), 0);
  if (!totaleAtteso) return 0;
  const morosita = calcolaMorosita(pagamenti);
  return (morosita / totaleAtteso) * 100;
}

// Stato salute edificio (0-100)
export function scoreEdificio(impianti: Impianto[], morositaPct: number): number {
  const impScore =
    impianti.length === 0
      ? 80
      : impianti.reduce(
          (s, i) => s + (i.stato === "ok" ? 100 : i.stato === "warning" ? 60 : 20),
          0
        ) / impianti.length;
  return Math.round(impScore * 0.7 + (100 - morositaPct * 10) * 0.3);
}

// Variazione % anno su anno
export function variazioneAnnua(attuale: number, precedente: number): string {
  if (!precedente) return "—";
  const pct = ((attuale - precedente) / precedente) * 100;
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

// Formattazione valuta EUR
export function formatEuro(value: number | null | undefined): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

// Con i centesimi. Sui totali arrotondare aiuta a leggere, ma su una riga che
// l'amministratore confronta con la fattura stampata no: una fattura da 269,50
// mostrata come "270 €" non si ritrova sul documento, e fa sembrare sbagliata
// un'estrazione che è giusta.
export function formatEuroPreciso(value: number | null | undefined): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

// Il costo di un'estrazione, detto in modo leggibile. Non è il prezzo in euro
// — quello dipende dal modello e dal listino — ma è il dato che lo determina,
// ed è l'unico che l'applicazione può conoscere con certezza.
export function formatUso(uso: UsoModello | undefined): string {
  if (!uso?.chiamate) return "";
  const migliaia = (n: number) => `${Math.round(n / 100) / 10}k`;
  return `Analisi: ${uso.chiamate} ${uso.chiamate === 1 ? "chiamata" : "chiamate"} al modello, ${migliaia(uso.tokenIngresso)} token in ingresso e ${migliaia(uso.tokenUscita)} in uscita.`;
}

export const MESI_LABEL = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

export const CATEGORIE_SPESA_LABEL: Record<string, string> = {
  riscaldamento: "Riscaldamento",
  ascensore: "Ascensore",
  pulizia: "Pulizia scale",
  assicurazione: "Assicurazione",
  amm: "Amministrazione",
  illuminazione: "Illuminazione",
  manutenzione: "Manutenzione",
  acqua: "Acqua",
  giardinaggio: "Giardinaggio",
  fotovoltaico: "Fotovoltaico",
  varie: "Varie",
};

export const IMPIANTI_LABEL: Record<string, string> = {
  riscaldamento: "Riscaldamento",
  ascensore: "Ascensore",
  areeVerdi: "Aree verdi",
  raffrescamento: "Raffrescamento",
  citofono: "Citofono / Videocitofono",
  parcheggio: "Parcheggio",
};
