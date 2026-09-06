import type { Impianto, Pagamento } from "@/lib/types";

// Quota mensile di un appartamento
export function quotaMensile(millesimi: number, consuntivoAnnuo: number): number {
  return Math.round((millesimi / 1000) * consuntivoAnnuo / 12);
}

// Quota annua di un appartamento
export function quotaAnnua(millesimi: number, consuntivoAnnuo: number): number {
  return Math.round((millesimi / 1000) * consuntivoAnnuo);
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
