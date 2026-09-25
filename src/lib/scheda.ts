// Una scheda di formato proposta dal modello: come si controlla, come si prova.
//
// Il modello non scrive codice: compila una scheda, cioè i dati che il motore
// sa già eseguire (`ProfiloFormato`), più la corrispondenza fra le voci del
// formato e le categorie dell'applicazione. Qui la scheda passa tre filtri
// prima di poter essere anche solo mostrata:
//
// 1. la forma: solo i campi che il motore conosce, espressioni regolari che si
//    compilano e che non possono impiantarsi su un testo lungo, categorie che
//    esistono;
// 2. la prova: il motore la esegue sul documento da cui è nata, e la lettura
//    deve quadrare al centesimo con il totale che il documento stampa, avere
//    un anno e non lasciare voci senza categoria;
// 3. una persona la approva. Fino ad allora il documento lo legge il modello
//    come prima, e la scheda aspetta.
//
// Un testo del PDF può contenere istruzioni per il modello: la peggiore scheda
// che ne può uscire legge male dei numeri, e il punto 2 se ne accorge.

import { CATEGORIE_SPESA_LABEL } from "./calcoli.ts";
import { leggiRendiconto, type SchedaApprovata } from "./lettura.ts";
import { riconosci, type ProfiloFormato, type RegolaVoce } from "./motore.ts";
import { RIMBORSO, type Destinazione, type Profilo } from "./profilo.ts";
import type { Pagina } from "./rendiconto.ts";

export type Proposta = SchedaApprovata;

export const DESTINAZIONI: readonly string[] = [...Object.keys(CATEGORIE_SPESA_LABEL), RIMBORSO];

const MAX_ESPRESSIONE = 200;
const MAX_VOCI_MAPPATE = 300;
const MAX_CHIAVE = 80;

// ---------------------------------------------------------------------------
// La forma
// ---------------------------------------------------------------------------

/**
 * Un'espressione regolare che si può eseguire su un documento intero.
 *
 * I quantificatori annidati — "(a+)+", "(\d*,)*" — su un testo che quasi
 * combacia fanno lavorare il motore regex per minuti: è il modo in cui una
 * scheda, che non esegue niente, potrebbe comunque fermare la funzione. Si
 * rifiutano, insieme ai riferimenti all'indietro, che non servono a leggere un
 * rendiconto.
 */
export function motivoEspressione(valore: unknown): string | null {
  if (typeof valore !== "string" || !valore) return "non è un testo";
  if (valore.length > MAX_ESPRESSIONE) return `più lunga di ${MAX_ESPRESSIONE} caratteri`;
  if (/\((?:[^()\\]|\\.)*?(?:[+*]|\{\d+,\d*\})(?:[^()\\]|\\.)*\)\??[+*{]/.test(valore)) {
    return "quantificatori annidati";
  }
  if (/\\[1-9]/.test(valore)) return "riferimenti all'indietro";
  try {
    new RegExp(valore, "i");
  } catch {
    return "non si compila";
  }
  return null;
}

function gruppi(espressione: string): number {
  return new RegExp(`${espressione}|`).exec("")!.length - 1;
}

type Oggetto = Record<string, unknown>;
const eOggetto = (v: unknown): v is Oggetto => typeof v === "object" && v !== null && !Array.isArray(v);

function controllaChiavi(valore: Oggetto, ammesse: string[], dove: string, errori: string[]) {
  for (const chiave of Object.keys(valore)) {
    if (!ammesse.includes(chiave)) errori.push(`${dove}: campo sconosciuto "${chiave}"`);
  }
}

function espressione(valore: unknown, dove: string, errori: string[], gruppiMinimi = 0): string | undefined {
  const motivo = motivoEspressione(valore);
  if (motivo) {
    errori.push(`${dove}: ${motivo}`);
    return undefined;
  }
  if (gruppi(valore as string) < gruppiMinimi) {
    errori.push(`${dove}: servono ${gruppiMinimi} gruppi di cattura`);
    return undefined;
  }
  return valore as string;
}

function colonna(valore: unknown, dove: string, errori: string[]): number | undefined {
  if (valore === undefined) return undefined;
  if (!Number.isInteger(valore) || (valore as number) < 0 || (valore as number) > 6) {
    errori.push(`${dove}: deve essere un intero fra 0 e 6`);
    return undefined;
  }
  return valore as number;
}

function voce(valore: unknown, errori: string[]): RegolaVoce | undefined {
  if (!eOggetto(valore)) {
    errori.push("voce: manca");
    return undefined;
  }
  if (valore.tipo === "codice") {
    controllaChiavi(valore, ["tipo", "schema"], "voce", errori);
    const schema = espressione(valore.schema, "voce.schema", errori);
    return schema ? { tipo: "codice", schema } : undefined;
  }
  if (valore.tipo === "intestazione") {
    controllaChiavi(valore, ["tipo", "rientroMassimo"], "voce", errori);
    const r = valore.rientroMassimo;
    if (typeof r !== "number" || !Number.isFinite(r) || r < 0 || r > 50) {
      errori.push("voce.rientroMassimo: deve essere un numero fra 0 e 50");
      return undefined;
    }
    return { tipo: "intestazione", rientroMassimo: r };
  }
  if (valore.tipo === "chiusura") {
    controllaChiavi(valore, ["tipo", "schema", "nomi"], "voce", errori);
    const schema = espressione(valore.schema, "voce.schema", errori, 2);
    const nomi = valore.nomi === undefined ? undefined : espressione(valore.nomi, "voce.nomi", errori, 2);
    if (!schema) return undefined;
    return nomi ? { tipo: "chiusura", schema, nomi } : { tipo: "chiusura", schema };
  }
  errori.push(`voce.tipo: "${String(valore.tipo)}" non è codice, intestazione o chiusura`);
  return undefined;
}

function mappa(valore: unknown, dove: string, errori: string[]): Record<string, Destinazione> {
  const out: Record<string, Destinazione> = {};
  if (valore === undefined) return out;
  if (!eOggetto(valore)) {
    errori.push(`${dove}: deve essere un oggetto`);
    return out;
  }
  const voci = Object.entries(valore);
  if (voci.length > MAX_VOCI_MAPPATE) errori.push(`${dove}: più di ${MAX_VOCI_MAPPATE} voci`);
  for (const [chiave, destinazione] of voci.slice(0, MAX_VOCI_MAPPATE)) {
    if (!chiave || chiave.length > MAX_CHIAVE) {
      errori.push(`${dove}: chiave vuota o troppo lunga`);
    } else if (typeof destinazione !== "string" || !DESTINAZIONI.includes(destinazione)) {
      errori.push(`${dove}["${chiave}"]: "${String(destinazione)}" non è una categoria`);
    } else {
      out[chiave] = destinazione as Destinazione;
    }
  }
  return out;
}

/**
 * La proposta del modello, se ha la forma che il motore sa eseguire.
 *
 * `riservati` sono i nomi dei formati che esistono già: una scheda nuova non
 * può chiamarsi come una vecchia, o la sua mappatura prenderebbe il posto
 * dell'altra.
 */
export function validaProposta(
  input: unknown,
  riservati: readonly string[]
): { proposta: Proposta; errori: [] } | { proposta: null; errori: string[] } {
  const errori: string[] = [];
  if (!eOggetto(input) || !eOggetto(input.scheda) || !eOggetto(input.mappatura)) {
    return { proposta: null, errori: ["servono due oggetti, scheda e mappatura"] };
  }
  const s = input.scheda;
  controllaChiavi(
    s,
    [
      "nome",
      "impronta",
      "colonnaTotale",
      "colonnaTotaleSecondaria",
      "intestazioni",
      "voce",
      "fornitore",
      "segno",
      "totaleGenerale",
      "personali",
      "fermatiAlTotale",
      "unisciVociSpezzate",
    ],
    "scheda",
    errori
  );

  const nome = typeof s.nome === "string" ? s.nome.trim() : "";
  if (nome.length < 3 || nome.length > 60) errori.push("scheda.nome: da 3 a 60 caratteri");
  if (riservati.some((r) => r.toLowerCase() === nome.toLowerCase())) {
    errori.push(`scheda.nome: "${nome}" esiste già`);
  }

  const impronta = espressione(s.impronta, "scheda.impronta", errori);
  // Un'impronta come "Totale" riconoscerebbe ogni rendiconto d'Italia.
  if (impronta && impronta.replace(/\\[a-z]|[^\p{L}\p{N} ]/giu, "").trim().length < 8) {
    errori.push("scheda.impronta: troppo generica, serve un testo tipico di questo formato");
  }

  const scheda: ProfiloFormato = {
    nome,
    impronta: impronta ?? "",
    voce: voce(s.voce, errori) ?? { tipo: "codice", schema: "$^" },
  };

  const colonnaTotale = colonna(s.colonnaTotale, "scheda.colonnaTotale", errori);
  if (colonnaTotale !== undefined) scheda.colonnaTotale = colonnaTotale;
  const secondaria = colonna(s.colonnaTotaleSecondaria, "scheda.colonnaTotaleSecondaria", errori);
  if (secondaria !== undefined) scheda.colonnaTotaleSecondaria = secondaria;
  if (scheda.voce.tipo !== "chiusura" && colonnaTotale === undefined) {
    errori.push("scheda.colonnaTotale: serve per le voci a codice o a intestazione");
  }

  if (s.intestazioni !== undefined) {
    if (!eOggetto(s.intestazioni)) {
      errori.push("scheda.intestazioni: deve essere un oggetto");
    } else {
      controllaChiavi(s.intestazioni, ["movimento", "totali"], "scheda.intestazioni", errori);
      const movimento = espressione(s.intestazioni.movimento, "scheda.intestazioni.movimento", errori);
      const totali = espressione(s.intestazioni.totali, "scheda.intestazioni.totali", errori);
      if (movimento && totali) scheda.intestazioni = { movimento, totali };
    }
  }

  if (s.fornitore !== undefined) {
    if (eOggetto(s.fornitore) && s.fornitore.tipo === "prima-del-numero" && Object.keys(s.fornitore).length === 1) {
      scheda.fornitore = { tipo: "prima-del-numero" };
    } else {
      errori.push('scheda.fornitore: l\'unica regola è { "tipo": "prima-del-numero" }');
    }
  }
  if (s.segno !== undefined) {
    if (s.segno === 1 || s.segno === -1) scheda.segno = s.segno;
    else errori.push("scheda.segno: 1 o -1");
  }

  const totale = espressione(s.totaleGenerale, "scheda.totaleGenerale", errori, 1);
  if (totale) scheda.totaleGenerale = totale;
  if (s.personali !== undefined) {
    const personali = espressione(s.personali, "scheda.personali", errori);
    if (personali) scheda.personali = personali;
  }
  for (const campo of ["fermatiAlTotale", "unisciVociSpezzate"] as const) {
    if (s[campo] === undefined) continue;
    if (typeof s[campo] === "boolean") scheda[campo] = s[campo] as boolean;
    else errori.push(`scheda.${campo}: vero o falso`);
  }

  const m = input.mappatura;
  controllaChiavi(m, ["voci", "personali"], "mappatura", errori);
  const mappatura: Profilo = {
    nome,
    voci: mappa(m.voci, "mappatura.voci", errori),
    personali: mappa(m.personali, "mappatura.personali", errori),
  };

  if (errori.length) return { proposta: null, errori };
  return { proposta: { scheda, mappatura }, errori: [] };
}

// ---------------------------------------------------------------------------
// La prova
// ---------------------------------------------------------------------------

export interface Verifica {
  utilizzabile: boolean;
  /** Perché non lo è, in una frase; null se lo è. */
  motivo: string | null;
  anno: number | null;
  totaleStampato: number | null;
  scarto: number | null;
  /** Ciò che il motore ha letto, per chi deve approvare. */
  voci: { chiave: string; descrizione: string; importo: number; categoria: string | null }[];
}

const MIN_VOCI = 2;

/** Esegue la scheda sul documento e dice se la lettura regge da sola. */
export function verificaProposta(pagine: Pagina[], proposta: Proposta): Verifica {
  const vuota = { anno: null, totaleStampato: null, scarto: null, voci: [] };
  if (!riconosci(pagine, [proposta.scheda])) {
    return { ...vuota, utilizzabile: false, motivo: "l'impronta non compare in questo documento" };
  }

  const letto = leggiRendiconto(pagine, [proposta]);
  if (!letto || letto.formato !== proposta.scheda.nome) {
    return { ...vuota, utilizzabile: false, motivo: `il documento è già di un formato conosciuto (${letto?.formato})` };
  }

  const { lettura } = letto;
  const voci = [
    ...lettura.voci.map((v) => ({
      chiave: v.chiave,
      descrizione: v.descrizione,
      importo: Math.round((v.importo + (v.importoSecondario ?? 0)) * 100) / 100,
      categoria: proposta.mappatura.voci[v.chiave] ?? null,
    })),
    ...lettura.personali.map((p) => ({
      chiave: p.chiave,
      descrizione: p.descrizione,
      importo: p.importo,
      categoria: proposta.mappatura.personali[p.chiave] ?? null,
    })),
  ];

  const motivo =
    letto.motivo ?? (lettura.voci.length < MIN_VOCI ? `lette solo ${lettura.voci.length} voci` : null);

  return {
    utilizzabile: motivo === null,
    motivo,
    anno: letto.anno,
    totaleStampato: lettura.totaleGenerale,
    scarto: lettura.scarto,
    voci,
  };
}

// ---------------------------------------------------------------------------
// Ciò che il modello vede
// ---------------------------------------------------------------------------

/**
 * Il documento come righe di frammenti con la loro posizione.
 *
 * Il motore ragiona per colonne e rientri: il modello, per proporre una scheda
 * che il motore sappia eseguire, deve vedere le stesse coordinate. Ogni
 * frammento è `[x-xFine] testo`, in punti tipografici.
 */
export function pagineComeTesto(pagine: Pagina[], limite = 60_000): string {
  const parti: string[] = [];
  let lunghezza = 0;
  for (const pagina of pagine) {
    const righe = pagina.righe
      .slice()
      .sort((a, b) => b.y - a.y)
      .map((r) =>
        r.frammenti
          .slice()
          .sort((a, b) => a.x - b.x)
          .filter((f) => f.testo.trim())
          .map((f) => `[${Math.round(f.x)}-${Math.round(f.xFine)}] ${f.testo.trim()}`)
          .join("  ")
      )
      .filter(Boolean);
    const blocco = `=== pagina ${pagina.numero} ===\n${righe.join("\n")}\n`;
    if (lunghezza + blocco.length > limite) {
      parti.push(`=== documento troncato dopo la pagina ${pagina.numero - 1} ===`);
      break;
    }
    parti.push(blocco);
    lunghezza += blocco.length;
  }
  return parti.join("\n");
}

/** Il primo oggetto JSON di una risposta, anche se il modello lo circonda di testo. */
export function jsonDi(risposta: string): unknown {
  const inizio = risposta.indexOf("{");
  const fine = risposta.lastIndexOf("}");
  if (inizio < 0 || fine <= inizio) return null;
  try {
    return JSON.parse(risposta.slice(inizio, fine + 1));
  } catch {
    return null;
  }
}
