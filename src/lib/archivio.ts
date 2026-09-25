import { createHash } from "node:crypto";

import {
  cartellaArchivio,
  destinoAlSalvataggio,
  percorsoArchivio,
  prefissoImpronta,
} from "./percorsi.ts";

// Solo i metodi di Storage che servono qui: la rotta passa il bucket vero
// (con la service role key), i test uno finto.
export interface Contenitore {
  download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
  list(
    cartella: string,
    opzioni: { search: string; limit: number }
  ): Promise<{ data: { name: string; id: string | null }[] | null; error: { message: string } | null }>;
  move(da: string, a: string): Promise<{ error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
}

export function improntaDi(bytes: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}

/** Il file dell'archivio del condominio che ha già questo contenuto, se c'è. */
export async function giaInArchivio(
  bucket: Contenitore,
  condominio: string,
  impronta: string
): Promise<string | null> {
  const cartella = cartellaArchivio(condominio);
  const { data, error } = await bucket.list(cartella, { search: prefissoImpronta(impronta), limit: 1 });
  if (error) throw new Error(`Elenco dell'archivio fallito: ${error.message}`);
  const trovato = (data ?? []).find((o) => o.id && o.name.startsWith(prefissoImpronta(impronta)));
  return trovato ? `${cartella}/${trovato.name}` : null;
}

/**
 * Porta un documento dentro l'archivio del condominio i cui dati lo citano,
 * e restituisce il percorso da salvare nelle righe. Se lo stesso contenuto è
 * già in archivio non se ne tiene una seconda copia: il file temporaneo si
 * cancella e le righe puntano a quello che c'era.
 *
 * Restituisce null per un percorso che chi salva non può citare: la riga resta
 * senza documento, che è meglio di un documento altrui.
 */
export async function archivia(
  bucket: Contenitore,
  path: string,
  nome: string,
  utente: string,
  condominio: string
): Promise<string | null> {
  const destino = destinoAlSalvataggio(path, utente, condominio);
  if (destino === "rifiuta") return null;
  if (destino === "tieni") return path;

  const { data, error } = await bucket.download(path);
  if (error || !data) throw new Error(`Il documento ${nome} non si trova più: ${error?.message ?? "vuoto"}`);
  const impronta = improntaDi(await data.arrayBuffer());

  const esistente = await giaInArchivio(bucket, condominio, impronta);
  if (esistente) {
    await bucket.remove([path]);
    return esistente;
  }

  const finale = percorsoArchivio(condominio, impronta, nome);
  const spostato = await bucket.move(path, finale);
  if (spostato.error) {
    // Due salvataggi dello stesso file nello stesso momento: il primo l'ha già
    // messo al suo posto, e il contenuto è lo stesso per costruzione.
    if (/exist/i.test(spostato.error.message) && (await giaInArchivio(bucket, condominio, impronta))) {
      await bucket.remove([path]);
      return finale;
    }
    throw new Error(`Archiviazione di ${nome} fallita: ${spostato.error.message}`);
  }
  return finale;
}

/**
 * Archivia più documenti, ciascuno una volta sola; la mappa va da percorso
 * caricato a percorso finale. Un documento che non si riesce ad archiviare non
 * ferma il salvataggio: i numeri restano, senza il link a quel file.
 */
export async function archiviaTutti(
  bucket: Contenitore,
  documenti: { name: string; path: string }[],
  utente: string,
  condominio: string
): Promise<Map<string, string | null>> {
  const esito = new Map<string, string | null>();
  for (const doc of documenti) {
    if (typeof doc?.path !== "string" || esito.has(doc.path)) continue;
    try {
      esito.set(doc.path, await archivia(bucket, doc.path, String(doc.name ?? ""), utente, condominio));
    } catch (error) {
      console.error(`Archiviazione di ${doc.path} fallita:`, error);
      esito.set(doc.path, null);
    }
  }
  return esito;
}
