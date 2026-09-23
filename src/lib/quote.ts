// Collegare la quota letta dal riparto all'unità dell'anagrafica.
//
// Il riparto nomina ogni unità con il codice dell'amministratore ("009") e con
// il nome del proprietario come lo scrive lui. L'anagrafica ha i propri dati.
// Qui si decide quale riga va con quale unità — e quando non si sa, si lascia
// la quota scollegata invece di attaccarla alla prima che somiglia.

import type { QuotaEstratta, QuotaUnita, TipologiaUnita, Unita } from "./types";

const MAX_TESTO = 200;
const MAX_COLONNE = 20;

/** La tipologia come la stampa il documento, ricondotta a quelle dell'app. */
export function tipologiaDi(testo: string | null | undefined): TipologiaUnita {
  const t = (testo ?? "").toLowerCase();
  if (t.includes("appartament")) return "appartamento";
  if (t.includes("box") || t.includes("garage") || t.includes("autorimess")) return "box";
  if (t.includes("cantin")) return "cantina";
  if (t.includes("posto")) return "posto_auto";
  return "altro";
}

// Due scritture dello stesso nome: "Arezzo - Petruccelli" e
// "Arezzo-Petruccelli" sono la stessa persona, e così le maiuscole.
function chiaveNome(nome: string | null | undefined): string {
  return (nome ?? "")
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function numeri(valore: unknown): Record<string, number> {
  if (!valore || typeof valore !== "object" || Array.isArray(valore)) return {};
  const out: Record<string, number> = {};
  for (const [chiave, v] of Object.entries(valore as Record<string, unknown>).slice(0, MAX_COLONNE)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[chiave.slice(0, MAX_TESTO)] = Math.round(n * 1000) / 1000;
  }
  return out;
}

/**
 * Le quote arrivano dal client, come ogni altra cosa del salvataggio: si tiene
 * solo ciò che ha la forma giusta.
 */
export function quoteValide(raw: unknown): QuotaEstratta[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((q): QuotaEstratta | null => {
      if (!q || typeof q !== "object") return null;
      const r = q as Record<string, unknown>;
      const codice = typeof r.codice === "string" ? r.codice.trim().slice(0, 20) : "";
      if (!codice) return null;

      const importi = numeri(r.importi);
      const totale = Number(r.totale);

      return {
        codice,
        tipologia: typeof r.tipologia === "string" ? r.tipologia.slice(0, 50) : "",
        sub: typeof r.sub === "string" ? r.sub.slice(0, 20) : "",
        nome: typeof r.nome === "string" ? r.nome.slice(0, MAX_TESTO) : "",
        importi,
        millesimi: numeri(r.millesimi),
        totale: Number.isFinite(totale) ? Math.round(totale * 100) / 100 : 0,
        pagina: Number.isFinite(Number(r.pagina)) ? Math.max(0, Math.round(Number(r.pagina))) : 0,
      };
    })
    .filter((q): q is QuotaEstratta => q !== null);
}

export interface Collegamento {
  /** Codice della quota → id dell'unità, per ogni quota che si è saputa collegare. */
  unitaPerCodice: Map<string, string>;
  /**
   * Unità riconosciute dal nome che non avevano ancora un codice. Glielo si
   * assegna, così dall'anno dopo il collegamento non dipende più dal nome.
   */
  codiciDaAssegnare: { unitaId: string; codice: string; sub: string }[];
}

/**
 * Collega ogni quota a un'unità dell'anagrafica.
 *
 * Prima per codice, che è stabile. Poi, per le unità che un codice non ce
 * l'hanno ancora — registrate prima che il riparto si leggesse — per tipologia
 * e nome, ma solo se il nome identifica una sola unità: due appartamenti dello
 * stesso proprietario sono esattamente il caso in cui indovinare sbaglia.
 */
export function collegaQuote(quote: QuotaEstratta[], unita: Unita[]): Collegamento {
  const unitaPerCodice = new Map<string, string>();
  const codiciDaAssegnare: Collegamento["codiciDaAssegnare"] = [];

  const perCodice = new Map(unita.filter((u) => u.codice).map((u) => [u.codice!, u]));
  const giaUsate = new Set<string>();

  for (const quota of quote) {
    const trovata = perCodice.get(quota.codice);
    if (trovata) {
      unitaPerCodice.set(quota.codice, trovata.id);
      giaUsate.add(trovata.id);
    }
  }

  for (const quota of quote) {
    if (unitaPerCodice.has(quota.codice)) continue;

    const tipologia = tipologiaDi(quota.tipologia);
    const nome = chiaveNome(quota.nome);
    if (!nome) continue;

    const candidate = unita.filter(
      (u) =>
        !u.codice &&
        !giaUsate.has(u.id) &&
        u.tipologia === tipologia &&
        chiaveNome(u.nome_proprietario) === nome
    );
    if (candidate.length !== 1) continue;

    unitaPerCodice.set(quota.codice, candidate[0].id);
    giaUsate.add(candidate[0].id);
    codiciDaAssegnare.push({ unitaId: candidate[0].id, codice: quota.codice, sub: quota.sub });
  }

  return { unitaPerCodice, codiciDaAssegnare };
}

// ---------------------------------------------------------------------------
// Leggere una quota
// ---------------------------------------------------------------------------

export interface VoceQuota {
  /** Il nome della colonna, senza la parola che dice di che tipo è. */
  nome: string;
  importo: number;
  /** I millesimi dell'unità in quella tabella; null per le spese a consumo. */
  millesimi: number | null;
}

export interface Scomposizione {
  /** Riscaldamento, acqua, consumi e spese personali: si pagano per quanto si usa. */
  aConsumo: VoceQuota[];
  /** Tutto il resto, ciascuno con la sua tabella millesimale. */
  perMillesimi: VoceQuota[];
  totaleAConsumo: number;
  totalePerMillesimi: number;
  totale: number;
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

// La distinzione non la decidiamo noi: la scrive il documento. Le colonne
// ripartite si intestano "Millesimi …"; le altre — "Spese Riscaldamento",
// "Personali e Rimborsi", "Consumi Enel Box/Cantine" — sono a consumo o
// personali. Nessun elenco di nomi da tenere aggiornato.
const RIPARTITA = /^Millesimi\s+/i;

/**
 * Divide la quota di un'unità fra ciò che dipende da quanto consuma e ciò che
 * si ripartisce per millesimi.
 *
 * È la distinzione che la divisione per millesimi cancellava: riscaldamento e
 * acqua sono la metà della spesa del condominio, e si pagano a contatore.
 */
export function scomponiQuota(quota: Pick<QuotaUnita, "importi" | "millesimi">): Scomposizione {
  const aConsumo: VoceQuota[] = [];
  const perMillesimi: VoceQuota[] = [];

  for (const [colonna, importo] of Object.entries(quota.importi)) {
    if (!importo) continue;
    if (RIPARTITA.test(colonna)) {
      perMillesimi.push({
        nome: colonna.replace(RIPARTITA, ""),
        importo,
        millesimi: quota.millesimi[colonna] ?? null,
      });
    } else {
      aConsumo.push({ nome: colonna.replace(/^Spese\s+/i, ""), importo, millesimi: null });
    }
  }

  const perImporto = (a: VoceQuota, b: VoceQuota) => Math.abs(b.importo) - Math.abs(a.importo);
  aConsumo.sort(perImporto);
  perMillesimi.sort(perImporto);

  const totaleAConsumo = arrotonda(aConsumo.reduce((t, v) => t + v.importo, 0));
  const totalePerMillesimi = arrotonda(perMillesimi.reduce((t, v) => t + v.importo, 0));

  return {
    aConsumo,
    perMillesimi,
    totaleAConsumo,
    totalePerMillesimi,
    totale: arrotonda(totaleAConsumo + totalePerMillesimi),
  };
}

/**
 * Le altre unità intestate allo stesso nome nello stesso rendiconto: il box,
 * la cantina, il posto auto di chi abita nell'appartamento.
 *
 * Il collegamento è il nome come lo stampa l'amministratore, dentro lo stesso
 * documento: è l'unico legame che il documento dichiara, e la pagina lo dice
 * per quello che è, invece di presentarlo come una proprietà accertata.
 */
export function pertinenzeDi(quota: QuotaUnita, tutte: QuotaUnita[]): QuotaUnita[] {
  const nome = chiaveNome(quota.nome_nel_documento);
  if (!nome) return [];

  return tutte
    .filter(
      (q) =>
        q.anno === quota.anno &&
        q.codice_unita !== quota.codice_unita &&
        tipologiaDi(q.tipologia) !== "appartamento" &&
        chiaveNome(q.nome_nel_documento) === nome
    )
    .sort((a, b) => a.codice_unita.localeCompare(b.codice_unita));
}
