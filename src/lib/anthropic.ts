import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modello specificato nella spec di prodotto CondoTwin.
export const EXTRACTION_MODEL = "claude-sonnet-4-6";
export const EXTRACTION_MAX_TOKENS = 8192;

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
