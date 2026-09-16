import type { ExtractedMovimento, Fonte, Movimento } from "./types";

const MAX_TESTO = 300;
const MAX_DESCRIZIONE = 300;
const MAX_FORNITORE = 200;

// Righe pronte per l'insert, ripulite: i movimenti arrivano dal client e da lì
// può arrivare qualsiasi cosa.
export function righeMovimenti(
  condominiumId: string,
  anno: number,
  movimenti: ExtractedMovimento[] | undefined,
  categorieValide: Record<string, unknown>,
  percorsoDi: (documento: string) => string | null
) {
  if (!Array.isArray(movimenti)) return [];

  return movimenti
    .map((movimento) => {
      const fonte = movimento?.fonte;
      const importo = Number(movimento?.importo);
      const categoria = typeof movimento?.categoria === "string" ? movimento.categoria : "";

      return {
        condominium_id: condominiumId,
        anno,
        data: /^\d{4}-\d{2}-\d{2}$/.test(String(movimento?.data)) ? movimento.data : null,
        descrizione: testo(movimento?.descrizione, MAX_DESCRIZIONE),
        fornitore: testo(movimento?.fornitore, MAX_FORNITORE) || null,
        categoria: categoria in categorieValide ? categoria : "varie",
        importo: Number.isFinite(importo) ? Math.round(importo * 100) / 100 : 0,
        fonte_documento: testo(fonte?.documento, 200) || null,
        fonte_pagina: pagina(fonte),
        fonte_testo: testo(fonte?.testo, MAX_TESTO) || null,
        fonte_verificata: fonte?.verificata === true,
        fonte_verificabile: fonte?.verificabile === true,
        documento_path: fonte?.documento ? percorsoDi(fonte.documento) : null,
      };
    })
    .filter((riga) => riga.importo !== 0);
}

// Raggruppamento per fornitore, usato dalla pagina Fornitori. Le righe senza
// fornitore non spariscono: finiscono sotto una voce dichiarata, perché sono
// spesa a tutti gli effetti.
export const SENZA_FORNITORE = "Non attribuito";

export interface TotaleFornitore {
  fornitore: string;
  totale: number;
  movimenti: Movimento[];
  categorie: string[];
  anni: number[];
  // true quando nessuna riga del fornitore nomina davvero una controparte.
  attribuito: boolean;
}

export function perFornitore(movimenti: Movimento[]): TotaleFornitore[] {
  const gruppi = new Map<string, Movimento[]>();

  for (const movimento of movimenti) {
    const nome = normalizzaFornitore(movimento.fornitore);
    const righe = gruppi.get(nome) ?? [];
    righe.push(movimento);
    gruppi.set(nome, righe);
  }

  return Array.from(gruppi.entries())
    .map(([fornitore, righe]) => ({
      fornitore,
      totale: Math.round(righe.reduce((t, m) => t + Number(m.importo), 0) * 100) / 100,
      movimenti: [...righe].sort((a, b) => Number(b.importo) - Number(a.importo)),
      categorie: Array.from(new Set(righe.map((m) => m.categoria))).sort(),
      anni: Array.from(new Set(righe.map((m) => m.anno))).sort((a, b) => b - a),
      attribuito: fornitore !== SENZA_FORNITORE,
    }))
    .sort((a, b) => b.totale - a.totale);
}

// "HERA S.p.A." e "Hera Spa" sono lo stesso fornitore: senza un minimo di
// normalizzazione la pagina mostrerebbe la stessa ditta più volte.
export function normalizzaFornitore(valore: string | null | undefined): string {
  const nome = (valore ?? "").trim();
  if (!nome) return SENZA_FORNITORE;

  return nome
    .replace(/\s+/g, " ")
    .replace(/[.,;]+$/, "")
    .replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?s?|s\.?n\.?c\.?|s\.?a\.?s\.?)\b/gi, (sigla) =>
      sigla.replace(/\./g, "").toUpperCase()
    )
    .trim();
}

function testo(valore: unknown, max: number): string {
  return typeof valore === "string" ? valore.trim().slice(0, max) : "";
}

function pagina(fonte: Fonte | null | undefined): number | null {
  const numero = Number(fonte?.pagina);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null;
}
