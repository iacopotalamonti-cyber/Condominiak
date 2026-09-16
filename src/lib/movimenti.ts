import type { ExtractedMovimento, Fonte } from "./types";

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
  percorsoDi: (documento: string) => string | null,
  // Risolve il nome letto nel documento nell'id dell'anagrafica. Assente in
  // fase di test o quando l'anagrafica non è ancora stata costruita.
  fornitoreId?: (nome: string) => string | null
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
        fornitore_id: fornitoreId?.(testo(movimento?.fornitore, MAX_FORNITORE)) ?? null,
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

function testo(valore: unknown, max: number): string {
  return typeof valore === "string" ? valore.trim().slice(0, max) : "";
}

function pagina(fonte: Fonte | null | undefined): number | null {
  const numero = Number(fonte?.pagina);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null;
}
