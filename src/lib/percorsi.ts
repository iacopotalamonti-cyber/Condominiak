// Dove sta un documento nel bucket, e chi può toccarlo.
//
// Un documento appartiene al condominio, non a chi l'ha caricato: se
// l'amministratore cambia, o sono in due a gestire lo stesso palazzo, i
// rendiconti devono restare dove sono e restare leggibili da tutti i membri.
//
//   pending/{utente}/{uuid}-{nome}              caricato, non ancora salvato
//   {condominio}/documenti/{impronta}-{nome}   letto e salvato nei dati
//   {condominio}/{timestamp}-{nome}            archivio caricato a mano
//
// C'è anche una forma storica, `documenti/{utente}/{uuid}-{nome}`: era
// l'archivio prima che i documenti passassero al condominio. La manutenzione
// di Storage la sposta; finché non l'ha fatto, la vede solo chi l'ha caricata.

export const BUCKET = "documenti-condominiali";
export const CARTELLA_TEMPORANEA = "pending";
export const CARTELLA_DOCUMENTI = "documenti";

// L'impronta nel nome è quella del contenuto: due caricamenti dello stesso
// PDF finiscono sullo stesso file invece di occupare spazio due volte.
// Sedici cifre esadecimali sono 64 bit: fra i documenti di un condominio una
// collisione non capita.
export const LUNGHEZZA_IMPRONTA = 16;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFISSO_NOME = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16}|\d{10,})-/i;

export type Collocazione =
  | { tipo: "temporaneo"; utente: string }
  | { tipo: "condominio"; condominio: string; archivio: boolean }
  | { tipo: "storico"; utente: string };

export function eUuid(valore: string): boolean {
  return UUID.test(valore);
}

/**
 * A chi appartiene un percorso, letto dalla sua forma. Un percorso che non ha
 * una delle forme previste non appartiene a nessuno: chi lo chiede riceve un
 * rifiuto, non un tentativo di indovinare.
 */
export function collocazione(path: string): Collocazione | null {
  if (typeof path !== "string" || path.length > 1024) return null;
  const segmenti = path.split("/");
  if (segmenti.some((s) => !s || s === "." || s === "..")) return null;

  const [primo, secondo] = segmenti;
  if (primo === CARTELLA_TEMPORANEA && segmenti.length === 3 && eUuid(secondo)) {
    return { tipo: "temporaneo", utente: secondo.toLowerCase() };
  }
  if (primo === CARTELLA_DOCUMENTI && segmenti.length === 3 && eUuid(secondo)) {
    return { tipo: "storico", utente: secondo.toLowerCase() };
  }
  if (eUuid(primo)) {
    if (segmenti.length === 2) return { tipo: "condominio", condominio: primo.toLowerCase(), archivio: false };
    if (segmenti.length === 3 && secondo === CARTELLA_DOCUMENTI) {
      return { tipo: "condominio", condominio: primo.toLowerCase(), archivio: true };
    }
  }
  return null;
}

/** Il nome con cui il file è stato caricato, senza il prefisso che lo rende unico. */
export function nomeFile(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(PREFISSO_NOME, "");
}

export function cartellaArchivio(condominio: string): string {
  return `${condominio}/${CARTELLA_DOCUMENTI}`;
}

export function percorsoArchivio(condominio: string, improntaContenuto: string, nome: string): string {
  // Il nome finisce dentro un percorso: le barre lo spezzerebbero in cartelle.
  const pulito = nome.replace(/[\\/]+/g, "_").trim().slice(0, 150) || "documento.pdf";
  return `${cartellaArchivio(condominio)}/${improntaContenuto.slice(0, LUNGHEZZA_IMPRONTA)}-${pulito}`;
}

/** Il prefisso da cercare nell'archivio per sapere se un contenuto c'è già. */
export function prefissoImpronta(improntaContenuto: string): string {
  return `${improntaContenuto.slice(0, LUNGHEZZA_IMPRONTA)}-`;
}

/**
 * Può leggerlo chi è membro del condominio a cui appartiene, o chi l'ha
 * caricato finché non appartiene ancora a nessun condominio.
 */
export function puoLeggere(path: string, utente: string, condominiMembro: readonly string[]): boolean {
  const c = collocazione(path);
  if (!c) return false;
  const io = utente.toLowerCase();
  if (c.tipo === "condominio") return condominiMembro.map((x) => x.toLowerCase()).includes(c.condominio);
  return c.utente === io;
}

/**
 * Può farlo analizzare chi l'ha appena caricato, o chi gestisce il condominio
 * a cui appartiene: rileggere un rendiconto costa una chiamata al modello, e
 * un condomino che legge non ne ha bisogno.
 */
export function puoEstrarre(path: string, utente: string, condominiAdmin: readonly string[]): boolean {
  const c = collocazione(path);
  if (!c) return false;
  const io = utente.toLowerCase();
  if (c.tipo === "condominio") return condominiAdmin.map((x) => x.toLowerCase()).includes(c.condominio);
  return c.utente === io;
}

/**
 * Che cosa fare di un documento quando i suoi dati entrano in un condominio.
 * Un file temporaneo di chi salva va archiviato; uno già nell'archivio di
 * quel condominio resta dov'è; qualunque altro percorso non si può citare —
 * altrimenti basterebbe scriverlo nei dati del proprio condominio per farsi
 * firmare il documento di un altro.
 */
export function destinoAlSalvataggio(
  path: string,
  utente: string,
  condominio: string
): "archivia" | "tieni" | "rifiuta" {
  const c = collocazione(path);
  if (!c) return "rifiuta";
  if (c.tipo === "temporaneo") return c.utente === utente.toLowerCase() ? "archivia" : "rifiuta";
  if (c.tipo === "condominio") return c.condominio === condominio.toLowerCase() ? "tieni" : "rifiuta";
  // Lo storico è di chi l'ha caricato: lo si cita finché la manutenzione non
  // l'ha spostato, e la manutenzione aggiorna anche le righe che lo citano.
  return c.utente === utente.toLowerCase() ? "tieni" : "rifiuta";
}
