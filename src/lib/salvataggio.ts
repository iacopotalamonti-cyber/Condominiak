// Le righe che il salvataggio di un esercizio scrive nel database.
//
// Stanno qui, e non dentro la rotta, perché sono la cosa da mettere alla
// prova: dato un rendiconto, l'app deve scrivere sempre gli stessi numeri.
// La rotta aggiunge solo ciò che richiede il database — chi è l'utente, dove
// finisce il file, quali fornitori esistono già — e poi scrive queste righe
// così come sono. Lo script di confronto dei consuntivi usa la stessa
// funzione, e quindi prova esattamente il codice che gira in produzione.

import { CAMPI_IMPORTO } from "./anthropic.ts";
import { CATEGORIE_SPESA_LABEL } from "./calcoli.ts";
import { righeMovimenti } from "./movimenti.ts";
import { quoteValide } from "./quote.ts";
import type { ExtractedMovimento, FonteSalvata, IncassoEstratto, QuotaEstratta } from "./types.ts";

export interface CorpoBilancio {
  anno: number;
  prev: number;
  cons: number;
  fondo: number;
  totale: number;
  spese: Record<string, number>;
  // Provenienza per campo: "prev", "cons", "fondo", "totale",
  // "spesa.riscaldamento", ...
  fonti: Record<string, unknown>;
  movimenti: ExtractedMovimento[];
  // Le partite di singoli condomini comprese nel totale del documento.
  incassi: IncassoEstratto[];
  // La quota di ogni unità, letta dal riparto.
  quote: unknown;
}

const MAX_TESTO_FONTE = 300;

export function importo(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

// La provenienza arriva dal client e finisce su Postgres: si tiene solo ciò
// che ha la forma attesa, e il testo si tronca perché è una riga di tabella,
// non un documento.
function fonte(value: unknown): FonteSalvata | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;

  const documento = typeof r.documento === "string" ? r.documento.slice(0, 200) : "";
  const pagina = Number.isFinite(Number(r.pagina)) ? Math.max(0, Math.round(Number(r.pagina))) : 0;
  const testo = typeof r.testo === "string" ? r.testo.slice(0, MAX_TESTO_FONTE) : "";

  if (!documento && !pagina && !testo) return null;
  return {
    documento,
    pagina,
    testo,
    verificata: r.verificata === true,
    verificabile: r.verificabile === true,
  };
}

export function fontiValide(raw: unknown): Record<string, FonteSalvata> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, FonteSalvata> = {};

  for (const campo of CAMPI_IMPORTO) {
    const valore = fonte(source[campo]);
    if (valore) out[campo] = valore;
  }

  return out;
}

export function righeBilancio(
  body: CorpoBilancio,
  condominiumId: string,
  documentoPath: string | null,
  // Risolve il nome letto nel documento nell'id dell'anagrafica fornitori.
  fornitoreId?: (nome: string) => string | null
) {
  const anno = Number(body.anno);
  const prev = importo(body.prev);
  const cons = importo(body.cons);
  const fondo = importo(body.fondo);
  const totale = importo(body.totale);
  const fonti = fontiValide(body.fonti);

  const bilancio =
    prev || cons || fondo
      ? {
          condominium_id: condominiumId,
          anno,
          preventivo: prev || null,
          consuntivo: cons || null,
          fondo_riserva: fondo || null,
          totale_documento: totale || null,
          fonti: (() => {
            const totali = Object.fromEntries(
              Object.entries(fonti).filter(([campo]) => !campo.startsWith("spesa."))
            );
            return Object.keys(totali).length ? totali : null;
          })(),
          documento_path: documentoPath,
        }
      : null;

  const spese = Object.entries(body.spese ?? {})
    .filter(([categoria]) => categoria in CATEGORIE_SPESA_LABEL)
    .map(([categoria, valore]) => {
      const origine = fonti[`spesa.${categoria}`];
      return {
        condominium_id: condominiumId,
        anno,
        categoria,
        importo: importo(valore),
        fonte_documento: origine?.documento || null,
        fonte_pagina: origine?.pagina || null,
        fonte_testo: origine?.testo || null,
        fonte_verificata: origine?.verificata ?? false,
        fonte_verificabile: origine?.verificabile ?? false,
        documento_path: documentoPath,
      };
    })
    .filter((riga) => riga.importo > 0);

  // Gli incassi arrivano dal client come tutto il resto: si tiene solo ciò
  // che ha la forma giusta, e l'importo conserva il segno perché è quello a
  // dire se il documento somma o sottrae la partita.
  const incassi = (Array.isArray(body.incassi) ? body.incassi : [])
    .map((incasso) => {
      const valore = Number(incasso?.importo);
      return {
        condominium_id: condominiumId,
        anno,
        descrizione:
          typeof incasso?.descrizione === "string" && incasso.descrizione.trim()
            ? incasso.descrizione.trim().slice(0, 300)
            : "Partita non descritta",
        importo: Number.isFinite(valore) ? Math.round(valore * 100) / 100 : 0,
        codice: typeof incasso?.codice === "string" ? incasso.codice.slice(0, 50) : null,
        fonte_documento: incasso?.fonte?.documento?.slice(0, 200) || null,
        fonte_pagina: incasso?.fonte?.pagina || null,
        fonte_testo: incasso?.fonte?.testo?.slice(0, MAX_TESTO_FONTE) || null,
        fonte_verificata: incasso?.fonte?.verificata === true,
        fonte_verificabile: incasso?.fonte?.verificabile === true,
        documento_path: documentoPath,
      };
    })
    .filter((riga) => riga.importo !== 0);

  const movimenti = righeMovimenti(
    condominiumId,
    anno,
    body.movimenti,
    CATEGORIE_SPESA_LABEL,
    () => documentoPath,
    fornitoreId
  );

  const quote: QuotaEstratta[] = quoteValide(body.quote);

  return { bilancio, spese, incassi, movimenti, quote };
}
