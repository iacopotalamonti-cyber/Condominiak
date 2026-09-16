import type { Fornitore, Movimento } from "./types";

export const SENZA_FORNITORE = "Non attribuito";

// Nome da mostrare: ripulito ma ancora leggibile come nel documento.
export function nomeLeggibile(valore: string | null | undefined): string {
  const nome = (valore ?? "").trim().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
  if (!nome) return "";

  return nome
    .replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?s?|s\.?n\.?c\.?|s\.?a\.?s\.?)\b/gi, (sigla) =>
      sigla.replace(/\./g, "").toUpperCase()
    )
    .trim();
}

// Chiave di riconoscimento: serve solo a capire se due scritture sono lo stesso
// fornitore, quindi butta via tutto ciò che varia da un documento all'altro —
// maiuscole, punteggiatura, forma societaria. Non si mostra mai.
export function chiaveFornitore(valore: string | null | undefined): string {
  return (valore ?? "")
    .toLowerCase()
    .replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?s?|s\.?n\.?c\.?|s\.?a\.?s\.?|societa'?|società)\b/g, " ")
    .replace(/[^a-z0-9àèéìòù ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tutte le scritture sotto cui riconoscere un fornitore dell'anagrafica.
export function chiaviDi(fornitore: Pick<Fornitore, "nome" | "alias">): string[] {
  return [fornitore.nome, ...(fornitore.alias ?? [])]
    .map(chiaveFornitore)
    .filter(Boolean);
}

// L'anagrafica indicizzata per chiave, per risolvere un nome letto nel
// documento senza ripetere la ricerca a ogni riga.
export function indiceFornitori(fornitori: Fornitore[]): Map<string, Fornitore> {
  const indice = new Map<string, Fornitore>();
  for (const fornitore of fornitori) {
    for (const chiave of chiaviDi(fornitore)) {
      if (!indice.has(chiave)) indice.set(chiave, fornitore);
    }
  }
  return indice;
}

export interface TotaleFornitore {
  id: string | null;
  nome: string;
  totale: number;
  movimenti: Movimento[];
  categorie: string[];
  anni: number[];
  // false per le righe che non nominano nessuna controparte.
  attribuito: boolean;
}

// Il raggruppamento segue l'anagrafica quando il movimento vi è collegato, e
// ricade sul nome scritto nel documento quando non lo è — per esempio per i
// movimenti salvati prima che l'anagrafica esistesse.
export function perFornitore(movimenti: Movimento[], fornitori: Fornitore[]): TotaleFornitore[] {
  const perId = new Map(fornitori.map((f) => [f.id, f]));
  const gruppi = new Map<string, { id: string | null; nome: string; righe: Movimento[] }>();

  for (const movimento of movimenti) {
    const anagrafica = movimento.fornitore_id ? perId.get(movimento.fornitore_id) : undefined;
    const nome = anagrafica?.nome ?? nomeLeggibile(movimento.fornitore) ?? "";
    const chiave = anagrafica?.id ?? chiaveFornitore(movimento.fornitore) ?? "";

    const gruppo = gruppi.get(chiave || SENZA_FORNITORE) ?? {
      id: anagrafica?.id ?? null,
      nome: nome || SENZA_FORNITORE,
      righe: [],
    };
    gruppo.righe.push(movimento);
    gruppi.set(chiave || SENZA_FORNITORE, gruppo);
  }

  return Array.from(gruppi.values())
    .map((gruppo) => ({
      id: gruppo.id,
      nome: gruppo.nome,
      totale: Math.round(gruppo.righe.reduce((t, m) => t + Number(m.importo), 0) * 100) / 100,
      movimenti: [...gruppo.righe].sort((a, b) => Number(b.importo) - Number(a.importo)),
      categorie: Array.from(new Set(gruppo.righe.map((m) => m.categoria))).sort(),
      anni: Array.from(new Set(gruppo.righe.map((m) => m.anno))).sort((a, b) => b - a),
      attribuito: gruppo.nome !== SENZA_FORNITORE,
    }))
    .sort((a, b) => b.totale - a.totale);
}
