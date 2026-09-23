import type { Impianto, Pagamento, UsoModello } from "@/lib/types";

// La quota di un appartamento non si calcola qui. Stava qui una divisione —
// millesimi dell'unità diviso millesimi totali, per la spesa dell'anno — ed è
// stata tolta: il condominio ripartisce con più tabelle millesimali e paga
// riscaldamento e acqua a contatore, e la divisione sbagliava da -34% a +59%.
// La quota vera si legge dal riparto del rendiconto: vedi src/lib/riparto.ts
// e la tabella quote_unita.

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
