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
  note: string | null;
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
  note: string | null;
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

export interface ExtractedBilancio {
  anno: number;
  prev: number;
  cons: number;
  fondo: number;
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
  spese: ExtractedSpese;
  imp: ExtractedImpianti;
  impDet: ExtractedImpiantiDettagli;
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
