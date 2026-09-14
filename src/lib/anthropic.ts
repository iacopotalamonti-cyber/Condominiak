import type {
  ExtractedBilancio,
  ExtractedImpianti,
  ExtractedImpiantiDettagli,
  ExtractedImpiantoDettaglio,
  ExtractedInfo,
  ExtractedSpese,
  ExtractedUnita,
  ExtractionResult,
} from "./types";

// Modello specificato nella spec di prodotto CondoTwin.
export const EXTRACTION_MODEL = "claude-sonnet-4-6";
export const EXTRACTION_MAX_TOKENS = 16000;

// Il tier dell'account impone un tetto di token in input per singola richiesta
// molto più basso della context window del modello: superarlo fa fallire la
// chiamata con 400 input_tokens_exceeded. I documenti vengono quindi analizzati
// uno per richiesta, e i PDF più lunghi di così spezzati in blocchi di pagine.
export const MAX_PAGES_PER_REQUEST = 20;

export const EXTRACTION_SCHEMA = `{
  "info": {"via":"","citta":"","cap":"","annoCostr":"","piani":0,"nApt":0,"pianoTerra":true,"amm":"","emailAmm":"","telAmm":""},
  "unita": [{"int":1,"piano":"T","mq":0,"ml":0,"nome":"","email":"","tel":""}],
  "bilanci": [{"anno":2024,"prev":0,"cons":0,"fondo":0},{"anno":2023,"prev":0,"cons":0,"fondo":0},{"anno":2022,"prev":0,"cons":0,"fondo":0},{"anno":2021,"prev":0,"cons":0,"fondo":0},{"anno":2020,"prev":0,"cons":0,"fondo":0}],
  "spese": {"riscaldamento":0,"ascensore":0,"pulizia":0,"assicurazione":0,"amm":0,"illuminazione":0,"manutenzione":0,"acqua":0,"giardinaggio":0,"varie":0},
  "imp": {"riscaldamento":false,"ascensore":false,"areeVerdi":false,"raffrescamento":false,"citofono":false,"parcheggio":false},
  "impDet": {
    "riscaldamento":{"marca":"","anno":"","ultima":"","contratto":"","scad":""},
    "ascensore":{"marca":"","anno":"","ultima":"","contratto":"","scad":""},
    "areeVerdi":{"fornitore":"","contratto":"","scad":""},
    "citofono":{"marca":"","anno":"","ultima":""}
  },
  "trovati": 0,
  "totale": 60,
  "confidence": {"info":0.0,"unita":0.0,"bilanci":0.0,"spese":0.0,"imp":0.0},
  "note": ""
}`;

export const EXTRACTION_PROMPT = `Sei un esperto di amministrazione condominiale italiana.
Analizza questi documenti (bilanci, verbali assemblee, tabelle millesimali, contratti) e
estrai tutti i dati strutturati disponibili.

Restituisci SOLO JSON valido, senza markdown, senza testo aggiuntivo, con questo schema esatto:
${EXTRACTION_SCHEMA}

Regole importanti:
- Usa SOLO dati esplicitamente presenti nei documenti — non inventare mai
- Per numeri non trovati usa 0, per stringhe usa ""
- I millesimi devono sommare il più vicino possibile a 1000
- "trovati" = conteggio campi con valore reale (non 0 e non "")
- "totale" è sempre 60
- "confidence" indica la tua certezza per ogni sezione (0.0-1.0)
- In "note" spiega cosa hai trovato e cosa manca
- I bilanci devono essere ordinati dal più recente (2024) al più antico (2020)`;

// Ogni documento viene analizzato in una richiesta separata: senza questa nota
// il modello prova a "completare" lo schema deducendo i campi che vede mancare,
// e in fase di fusione quei valori inventati sovrascriverebbero quelli reali
// estratti dagli altri documenti.
export function extractionPrompt(label: string, index: number, total: number): string {
  if (total <= 1) return EXTRACTION_PROMPT;

  return `${EXTRACTION_PROMPT}

CONTESTO: stai analizzando solo una parte della documentazione (${label} — blocco ${index} di ${total}).
Estrai esclusivamente i dati presenti in QUESTO blocco e lascia a 0 / "" tutto il resto: i campi
mancanti vengono recuperati dagli altri blocchi. Non dedurre, stimare o completare valori assenti qui.`;
}

const CATEGORIE_SPESA = [
  "riscaldamento",
  "ascensore",
  "pulizia",
  "assicurazione",
  "amm",
  "illuminazione",
  "manutenzione",
  "acqua",
  "giardinaggio",
  "varie",
] as const;

const TIPI_IMPIANTO = [
  "riscaldamento",
  "ascensore",
  "areeVerdi",
  "raffrescamento",
  "citofono",
  "parcheggio",
] as const;

const IMPIANTI_CON_DETTAGLI = ["riscaldamento", "ascensore", "areeVerdi", "citofono"] as const;

const CAMPI_DETTAGLIO = ["marca", "anno", "ultima", "contratto", "scad", "fornitore"] as const;

export const TOTALE_CAMPI = 60;

function mapSpese(valore: (categoria: (typeof CATEGORIE_SPESA)[number]) => number): ExtractedSpese {
  return {
    riscaldamento: valore("riscaldamento"),
    ascensore: valore("ascensore"),
    pulizia: valore("pulizia"),
    assicurazione: valore("assicurazione"),
    amm: valore("amm"),
    illuminazione: valore("illuminazione"),
    manutenzione: valore("manutenzione"),
    acqua: valore("acqua"),
    giardinaggio: valore("giardinaggio"),
    varie: valore("varie"),
  };
}

function mapImpianti(
  presente: (tipo: (typeof TIPI_IMPIANTO)[number]) => boolean
): ExtractedImpianti {
  return {
    riscaldamento: presente("riscaldamento"),
    ascensore: presente("ascensore"),
    areeVerdi: presente("areeVerdi"),
    raffrescamento: presente("raffrescamento"),
    citofono: presente("citofono"),
    parcheggio: presente("parcheggio"),
  };
}

// Ripulisce l'output testuale del modello (fence markdown, prosa residua) e
// lo fa combaciare con il JSON dello schema di estrazione.
export function parseExtractionOutput(text: string): unknown {
  let clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(clean);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function confidence(value: unknown): number {
  return Math.min(1, Math.max(0, num(value)));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function emptyExtraction(): ExtractionResult {
  return {
    info: {
      via: "",
      citta: "",
      cap: "",
      annoCostr: "",
      piani: 0,
      nApt: 0,
      pianoTerra: false,
      amm: "",
      emailAmm: "",
      telAmm: "",
    },
    unita: [],
    bilanci: [],
    spese: mapSpese(() => 0),
    imp: mapImpianti(() => false),
    impDet: {},
    trovati: 0,
    totale: TOTALE_CAMPI,
    confidence: { info: 0, unita: 0, bilanci: 0, spese: 0, imp: 0 },
    note: "",
  };
}

// L'output del modello è JSON libero: qualsiasi campo può mancare o avere il
// tipo sbagliato. Normalizzare qui evita che un singolo campo malformato faccia
// esplodere la fusione o il wizard.
export function normalizeExtraction(raw: unknown): ExtractionResult {
  const r = record(raw);
  const info = record(r.info);
  const spese = record(r.spese);
  const imp = record(r.imp);
  const conf = record(r.confidence);

  const result: ExtractionResult = {
    info: {
      via: str(info.via),
      citta: str(info.citta),
      cap: str(info.cap),
      annoCostr: str(info.annoCostr),
      piani: num(info.piani),
      nApt: num(info.nApt),
      pianoTerra: info.pianoTerra === true,
      amm: str(info.amm),
      emailAmm: str(info.emailAmm),
      telAmm: str(info.telAmm),
    },
    unita: (Array.isArray(r.unita) ? r.unita : [])
      .map((u) => {
        const item = record(u);
        return {
          int: num(item.int),
          piano: str(item.piano),
          mq: num(item.mq),
          ml: num(item.ml),
          nome: str(item.nome),
          email: str(item.email),
          tel: str(item.tel),
        };
      })
      .filter((u) => u.int > 0),
    bilanci: (Array.isArray(r.bilanci) ? r.bilanci : [])
      .map((b) => {
        const item = record(b);
        return {
          anno: num(item.anno),
          prev: num(item.prev),
          cons: num(item.cons),
          fondo: num(item.fondo),
        };
      })
      .filter((b) => b.anno > 0),
    spese: mapSpese((c) => num(spese[c])),
    imp: mapImpianti((t) => imp[t] === true),
    impDet: normalizeImpDet(r.impDet),
    trovati: 0,
    totale: TOTALE_CAMPI,
    confidence: {
      info: confidence(conf.info),
      unita: confidence(conf.unita),
      bilanci: confidence(conf.bilanci),
      spese: confidence(conf.spese),
      imp: confidence(conf.imp),
    },
    note: str(r.note),
  };

  result.trovati = contaCampiTrovati(result);
  return result;
}

function normalizeImpDet(raw: unknown): ExtractedImpiantiDettagli {
  const source = record(raw);
  const out: ExtractedImpiantiDettagli = {};

  for (const tipo of IMPIANTI_CON_DETTAGLI) {
    const dettaglio = record(source[tipo]);
    const normalized: ExtractedImpiantoDettaglio = {};
    for (const campo of CAMPI_DETTAGLIO) {
      const value = str(dettaglio[campo]);
      if (value) normalized[campo] = value;
    }
    if (Object.keys(normalized).length) out[tipo] = normalized;
  }

  return out;
}

function pickStr(a: string, b: string, preferB: boolean): string {
  if (!a) return b;
  if (!b) return a;
  return preferB ? b : a;
}

function pickNum(a: number, b: number, preferB: boolean): number {
  if (!a) return b;
  if (!b) return a;
  return preferB ? b : a;
}

// Ogni documento produce un'estrazione parziale: la fusione tiene il valore
// valorizzato e, quando entrambi lo sono, quello del documento che dichiara
// più confidenza sulla sezione.
export function mergeExtractions(results: ExtractionResult[]): ExtractionResult {
  if (!results.length) return emptyExtraction();

  const merged = results.reduce(mergePair);
  merged.note = Array.from(new Set(results.map((r) => r.note).filter(Boolean))).join(" ");
  merged.trovati = contaCampiTrovati(merged);
  return merged;
}

function mergePair(a: ExtractionResult, b: ExtractionResult): ExtractionResult {
  return {
    info: mergeInfo(a.info, b.info, b.confidence.info > a.confidence.info),
    unita: mergeUnita(a.unita, b.unita, b.confidence.unita > a.confidence.unita),
    bilanci: mergeBilanci(a.bilanci, b.bilanci, b.confidence.bilanci > a.confidence.bilanci),
    spese: mapSpese((c) =>
      pickNum(a.spese[c], b.spese[c], b.confidence.spese > a.confidence.spese)
    ),
    imp: mapImpianti((t) => a.imp[t] || b.imp[t]),
    impDet: mergeImpDet(a.impDet, b.impDet),
    trovati: 0,
    totale: TOTALE_CAMPI,
    confidence: {
      info: Math.max(a.confidence.info, b.confidence.info),
      unita: Math.max(a.confidence.unita, b.confidence.unita),
      bilanci: Math.max(a.confidence.bilanci, b.confidence.bilanci),
      spese: Math.max(a.confidence.spese, b.confidence.spese),
      imp: Math.max(a.confidence.imp, b.confidence.imp),
    },
    note: "",
  };
}

function mergeInfo(a: ExtractedInfo, b: ExtractedInfo, preferB: boolean): ExtractedInfo {
  return {
    via: pickStr(a.via, b.via, preferB),
    citta: pickStr(a.citta, b.citta, preferB),
    cap: pickStr(a.cap, b.cap, preferB),
    annoCostr: pickStr(a.annoCostr, b.annoCostr, preferB),
    piani: pickNum(a.piani, b.piani, preferB),
    nApt: pickNum(a.nApt, b.nApt, preferB),
    pianoTerra: a.pianoTerra || b.pianoTerra,
    amm: pickStr(a.amm, b.amm, preferB),
    emailAmm: pickStr(a.emailAmm, b.emailAmm, preferB),
    telAmm: pickStr(a.telAmm, b.telAmm, preferB),
  };
}

function mergeUnita(
  a: ExtractedUnita[],
  b: ExtractedUnita[],
  preferB: boolean
): ExtractedUnita[] {
  const byInterno = new Map<number, ExtractedUnita>();

  for (const unita of a) byInterno.set(unita.int, unita);
  for (const unita of b) {
    const existing = byInterno.get(unita.int);
    if (!existing) {
      byInterno.set(unita.int, unita);
      continue;
    }
    byInterno.set(unita.int, {
      int: unita.int,
      piano: pickStr(existing.piano, unita.piano, preferB),
      mq: pickNum(existing.mq, unita.mq, preferB),
      ml: pickNum(existing.ml, unita.ml, preferB),
      nome: pickStr(existing.nome, unita.nome, preferB),
      email: pickStr(existing.email, unita.email, preferB),
      tel: pickStr(existing.tel, unita.tel, preferB),
    });
  }

  return Array.from(byInterno.values()).sort((x, y) => x.int - y.int);
}

function mergeBilanci(
  a: ExtractedBilancio[],
  b: ExtractedBilancio[],
  preferB: boolean
): ExtractedBilancio[] {
  const byAnno = new Map<number, ExtractedBilancio>();

  for (const bilancio of a) byAnno.set(bilancio.anno, bilancio);
  for (const bilancio of b) {
    const existing = byAnno.get(bilancio.anno);
    if (!existing) {
      byAnno.set(bilancio.anno, bilancio);
      continue;
    }
    byAnno.set(bilancio.anno, {
      anno: bilancio.anno,
      prev: pickNum(existing.prev, bilancio.prev, preferB),
      cons: pickNum(existing.cons, bilancio.cons, preferB),
      fondo: pickNum(existing.fondo, bilancio.fondo, preferB),
    });
  }

  return Array.from(byAnno.values()).sort((x, y) => y.anno - x.anno);
}

function mergeImpDet(
  a: ExtractedImpiantiDettagli,
  b: ExtractedImpiantiDettagli
): ExtractedImpiantiDettagli {
  const out: ExtractedImpiantiDettagli = {};

  for (const tipo of IMPIANTI_CON_DETTAGLI) {
    const dettaglio: ExtractedImpiantoDettaglio = {};
    for (const campo of CAMPI_DETTAGLIO) {
      const value = a[tipo]?.[campo] || b[tipo]?.[campo];
      if (value) dettaglio[campo] = value;
    }
    if (Object.keys(dettaglio).length) out[tipo] = dettaglio;
  }

  return out;
}

// I 60 campi dello schema: 9 di anagrafica, 10 unità, 15 valori di bilancio,
// 10 voci di spesa, 6 impianti, 10 dettagli impianto.
function contaCampiTrovati(r: ExtractionResult): number {
  let trovati = [r.info.via, r.info.citta, r.info.cap, r.info.annoCostr, r.info.amm, r.info.emailAmm, r.info.telAmm].filter(Boolean).length;
  if (r.info.piani) trovati++;
  if (r.info.nApt) trovati++;

  trovati += Math.min(r.unita.length, 10);
  trovati += Math.min(
    r.bilanci.reduce((acc, b) => acc + (b.prev ? 1 : 0) + (b.cons ? 1 : 0) + (b.fondo ? 1 : 0), 0),
    15
  );
  trovati += CATEGORIE_SPESA.filter((c) => r.spese[c]).length;
  trovati += TIPI_IMPIANTO.filter((t) => r.imp[t]).length;
  trovati += Math.min(
    IMPIANTI_CON_DETTAGLI.reduce((acc, tipo) => acc + Object.keys(r.impDet[tipo] ?? {}).length, 0),
    10
  );

  return Math.min(trovati, TOTALE_CAMPI);
}
