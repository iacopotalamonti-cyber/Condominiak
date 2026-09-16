export type Role = "admin" | "resident";

export interface Condominium {
  id: string;
  created_at: string;
  updated_at: string;
  via: string;
  civico: string | null;
  citta: string;
  cap: string | null;
  provincia: string | null;
  anno_costruzione: number | null;
  piani: number;
  n_appartamenti: number;
  piano_terra: boolean;
  nome_amm: string | null;
  email_amm: string | null;
  tel_amm: string | null;
  owner_id: string;
}

export interface Unita {
  id: string;
  created_at: string;
  condominium_id: string;
  interno: number;
  piano: string | null;
  mq: number | null;
  millesimi: number;
  nome_proprietario: string | null;
  email: string | null;
  telefono: string | null;
  user_id: string | null;
}

export interface Bilancio {
  id: string;
  created_at: string;
  condominium_id: string;
  anno: number;
  preventivo: number | null;
  consuntivo: number | null;
  fondo_riserva: number | null;
  // Totale stampato nel documento, per rifare la verifica di quadratura
  // anche dopo il salvataggio.
  totale_documento: number | null;
  // Provenienza dei tre importi: da quale documento, a che pagina e con quale
  // riga di testo il valore è stato letto.
  fonti: Record<string, FonteSalvata> | null;
  documento_path: string | null;
  note: string | null;
}

// Forma con cui una Fonte viene salvata su Postgres (jsonb).
export interface FonteSalvata {
  documento: string;
  pagina: number;
  testo: string;
  verificata: boolean;
  verificabile: boolean;
}

export type CategoriaSpesa =
  | "riscaldamento"
  | "ascensore"
  | "pulizia"
  | "assicurazione"
  | "amm"
  | "illuminazione"
  | "manutenzione"
  | "acqua"
  | "giardinaggio"
  | "varie";

export interface Spesa {
  id: string;
  created_at: string;
  condominium_id: string;
  anno: number;
  categoria: string;
  importo: number;
  fonte_documento: string | null;
  fonte_pagina: number | null;
  fonte_testo: string | null;
  fonte_verificata: boolean;
  fonte_verificabile: boolean;
  documento_path: string | null;
  note: string | null;
}

// Una riga del rendiconto analitico: la spesa come è stata realmente sostenuta,
// con il fornitore che l'ha emessa.
export interface Movimento {
  id: string;
  created_at: string;
  condominium_id: string;
  anno: number;
  data: string | null;
  descrizione: string;
  fornitore: string | null;
  categoria: string;
  importo: number;
  fonte_documento: string | null;
  fonte_pagina: number | null;
  fonte_testo: string | null;
  fonte_verificata: boolean;
  fonte_verificabile: boolean;
  documento_path: string | null;
}

export type TipoImpianto =
  | "riscaldamento"
  | "ascensore"
  | "areeVerdi"
  | "raffrescamento"
  | "citofono"
  | "parcheggio";

export type StatoImpianto = "ok" | "warning" | "critical";

export interface Impianto {
  id: string;
  created_at: string;
  updated_at: string;
  condominium_id: string;
  tipo: string;
  presente: boolean;
  marca: string | null;
  anno_installazione: string | null;
  ultima_revisione: string | null;
  contratto_ditta: string | null;
  scadenza_contratto: string | null;
  stato: StatoImpianto;
  note: string | null;
}

export type StatoPagamento = "ok" | "ritardo" | "non_pagato";

export interface Pagamento {
  id: string;
  created_at: string;
  condominium_id: string;
  unita_id: string;
  anno: number;
  mese: number;
  importo: number | null;
  stato: StatoPagamento;
  data_pagamento: string | null;
  note: string | null;
}

export type TipoDocumento =
  | "verbale"
  | "bilancio"
  | "contratto"
  | "assicurazione"
  | "certificazione"
  | "altro";

export interface Documento {
  id: string;
  created_at: string;
  condominium_id: string;
  nome: string;
  tipo: TipoDocumento | null;
  storage_path: string | null;
  data_emissione: string | null;
  data_scadenza: string | null;
  ai_processed: boolean;
  ai_extracted_at: string | null;
  ai_confidence: number | null;
  note: string | null;
}

// -----------------------------------------------------------------------
// Estrazione AI (wizard onboarding)
// -----------------------------------------------------------------------

export interface ExtractedInfo {
  via: string;
  citta: string;
  cap: string;
  annoCostr: string;
  piani: number;
  nApt: number;
  pianoTerra: boolean;
  amm: string;
  emailAmm: string;
  telAmm: string;
}

export interface ExtractedUnita {
  int: number;
  piano: string;
  mq: number;
  ml: number;
  nome: string;
  email: string;
  tel: string;
}

export interface ExtractedSpese {
  riscaldamento: number;
  ascensore: number;
  pulizia: number;
  assicurazione: number;
  amm: number;
  illuminazione: number;
  manutenzione: number;
  acqua: number;
  giardinaggio: number;
  varie: number;
}

// Da dove arriva un importo. Senza questo un numero sbagliato è
// indistinguibile da uno giusto: l'amministratore non ha modo di risalire al
// punto del documento da cui il modello dice di averlo letto.
export interface Fonte {
  documento: string;
  // 1-based e riferita al documento intero, non al blocco di pagine inviato
  // al modello: le pagine vengono riportate all'originale in fase di lettura.
  pagina: number;
  // La riga copiata alla lettera dal documento, non una parafrasi.
  testo: string;
  // true se le cifre dell'importo sono state ritrovate nel testo di quella
  // pagina del PDF, estratto da noi: è un controllo sul documento, non una
  // dichiarazione del modello.
  verificata: boolean;
  // false quando il controllo non si è potuto fare — PDF scansionato senza
  // livello di testo, immagine, o pagina non indicata. Serve a distinguere
  // "ho controllato e non c'è" da "non ho potuto controllare".
  verificabile: boolean;
}

// I campi importo di un bilancio, nella forma usata come chiave in `fonti` e
// `conflitti`: "prev", "cons", "fondo", "totale", "spesa.riscaldamento", ...
export type CampoImporto = "prev" | "cons" | "fondo" | "totale" | `spesa.${CategoriaSpesa}`;

// Il valore che la fusione ha scartato quando due documenti danno importi
// diversi per lo stesso campo: viene conservato e mostrato invece che perso.
export interface ValoreScartato {
  valore: number;
  fonte: Fonte | null;
}

export type LivelloControllo = "errore" | "avviso";

export interface Controllo {
  // Campo a cui si riferisce, "" se riguarda l'intero bilancio.
  campo: CampoImporto | "";
  livello: LivelloControllo;
  messaggio: string;
}

export interface ExtractedMovimento {
  // Formato AAAA-MM-GG quando il documento la riporta, altrimenti "".
  data: string;
  descrizione: string;
  // Vuoto quando la riga non nomina un fornitore: consumi, conguagli, giroconti.
  fornitore: string;
  categoria: CategoriaSpesa;
  importo: number;
  fonte: Fonte | null;
}

export interface ExtractedBilancio {
  anno: number;
  prev: number;
  cons: number;
  fondo: number;
  // Le spese appartengono all'esercizio, non al condominio: tenerle qui
  // impedisce che la voce di un anno finisca attribuita a un altro.
  spese: ExtractedSpese;
  // Il dettaglio riga per riga, quando il documento è analitico. Se c'è, i
  // totali in `spese` sono la somma di queste righe e non una lettura a parte.
  movimenti: ExtractedMovimento[];
  // Il totale stampato nel documento, quando c'è: serve a verificare la somma
  // delle voci senza doversi fidare del modello.
  totale: number;
  fonti: Partial<Record<CampoImporto, Fonte>>;
  conflitti: Partial<Record<CampoImporto, ValoreScartato[]>>;
}

export interface ExtractedImpianti {
  riscaldamento: boolean;
  ascensore: boolean;
  areeVerdi: boolean;
  raffrescamento: boolean;
  citofono: boolean;
  parcheggio: boolean;
}

export interface ExtractedImpiantoDettaglio {
  marca?: string;
  anno?: string;
  ultima?: string;
  contratto?: string;
  scad?: string;
  fornitore?: string;
}

export interface ExtractedImpiantiDettagli {
  riscaldamento?: ExtractedImpiantoDettaglio;
  ascensore?: ExtractedImpiantoDettaglio;
  areeVerdi?: ExtractedImpiantoDettaglio;
  citofono?: ExtractedImpiantoDettaglio;
}

export interface ExtractionResult {
  info: ExtractedInfo;
  unita: ExtractedUnita[];
  bilanci: ExtractedBilancio[];
  imp: ExtractedImpianti;
  impDet: ExtractedImpiantiDettagli;
  // I documenti da cui viene l'estrazione, per riaprire il PDF alla pagina
  // indicata dalla fonte.
  documenti: UploadedFile[];
  trovati: number;
  totale: number;
  confidence: {
    info: number;
    unita: number;
    bilanci: number;
    spese: number;
    imp: number;
  };
  note: string;
}

// Il file viene caricato dal browser direttamente su Supabase Storage
// (bypassando il limite di payload delle funzioni serverless): qui passa
// solo il percorso, non i byte.
export interface UploadedFile {
  name: string;
  type: string;
  path: string;
}
