// Mettere ogni file del bucket al suo posto, senza mai perdere un contenuto.
//
// Fuori dalle cartelle dei condomini restano due tipi di file:
//
// - lo storico, `documenti/{utente}/...`: l'archivio di prima, quando i
//   documenti erano di chi li caricava. Va nel condominio i cui dati lo citano.
// - i caricamenti, `pending/{utente}/...`: file caricati e mai salvati. Se un
//   dato li cita (è successo quando l'archiviazione falliva) vanno nel
//   condominio come lo storico; se no, e sono doppioni di un file già in
//   archivio, occupano spazio per niente.
//
// Un file il cui contenuto non esiste da nessun'altra parte non si cancella
// mai: al massimo resta dov'è, e il rapporto lo dice.

import { giaInArchivio, improntaDi, type Contenitore } from "./archivio.ts";
import { collocazione, nomeFile, percorsoArchivio } from "./percorsi.ts";

export interface Bucket extends Contenitore {
  copy(da: string, a: string): Promise<{ error: { message: string } | null }>;
}

export interface Dati {
  /** I condomini delle righe che citano questo percorso. */
  condominiCheCitano(path: string): Promise<string[]>;
  /** I condomini che l'utente amministra. */
  condominiAmministrati(utente: string): Promise<string[]>;
  /** Fa puntare a `a` ogni riga che punta a `da`. */
  sostituisci(da: string, a: string): Promise<void>;
}

export type Esito =
  | { azione: "spostato"; a: string }
  | { azione: "doppione rimosso"; uguale_a: string }
  | { azione: "lasciato"; motivo: string };

// Un caricamento recente può essere un'analisi ancora in corso, o in attesa
// che l'amministratore controlli i numeri e salvi.
export const ETA_MINIMA_CARICAMENTO_MS = 24 * 60 * 60_000;

async function condominioDi(dati: Dati, path: string, utente: string, storico: boolean) {
  const citanti = [...new Set(await dati.condominiCheCitano(path))];
  if (citanti.length === 1) return citanti[0];
  if (citanti.length > 1) return null;
  if (!storico) return null;
  // Lo storico che nessun dato cita è comunque un documento dell'archivio: se
  // chi l'ha caricato amministra un solo condominio, è di quello.
  const amministrati = await dati.condominiAmministrati(utente);
  return amministrati.length === 1 ? amministrati[0] : null;
}

async function porta(bucket: Bucket, dati: Dati, path: string, condominio: string): Promise<Esito> {
  const { data, error } = await bucket.download(path);
  if (error || !data) return { azione: "lasciato", motivo: `non si scarica: ${error?.message ?? "vuoto"}` };
  const impronta = improntaDi(await data.arrayBuffer());

  // Prima la copia, poi le righe, e solo alla fine si cancella l'originale:
  // interrotto a metà, lascia un file in più, mai un link rotto.
  let destinazione = await giaInArchivio(bucket, condominio, impronta);
  if (!destinazione) {
    destinazione = percorsoArchivio(condominio, impronta, nomeFile(path));
    const copia = await bucket.copy(path, destinazione);
    if (copia.error) return { azione: "lasciato", motivo: `copia fallita: ${copia.error.message}` };
  }
  await dati.sostituisci(path, destinazione);
  const rimosso = await bucket.remove([path]);
  if (rimosso.error) return { azione: "lasciato", motivo: `copiato ma non rimosso: ${rimosso.error.message}` };
  return { azione: "spostato", a: destinazione };
}

export async function sistema(
  bucket: Bucket,
  dati: Dati,
  file: { path: string; creato: string | null },
  adesso: Date
): Promise<Esito> {
  const c = collocazione(file.path);
  if (!c || c.tipo === "condominio") return { azione: "lasciato", motivo: "già al suo posto" };

  const storico = c.tipo === "storico";
  const condominio = await condominioDi(dati, file.path, c.utente, storico);
  if (condominio) return porta(bucket, dati, file.path, condominio);
  if (storico) return { azione: "lasciato", motivo: "non si sa di quale condominio sia" };

  const eta = file.creato ? adesso.getTime() - new Date(file.creato).getTime() : 0;
  if (!(eta >= ETA_MINIMA_CARICAMENTO_MS)) return { azione: "lasciato", motivo: "caricato da poco" };

  const { data, error } = await bucket.download(file.path);
  if (error || !data) return { azione: "lasciato", motivo: `non si scarica: ${error?.message ?? "vuoto"}` };
  const impronta = improntaDi(await data.arrayBuffer());

  for (const condominio of await dati.condominiAmministrati(c.utente)) {
    const uguale = await giaInArchivio(bucket, condominio, impronta);
    if (uguale) {
      const rimosso = await bucket.remove([file.path]);
      if (rimosso.error) return { azione: "lasciato", motivo: `doppione non rimosso: ${rimosso.error.message}` };
      return { azione: "doppione rimosso", uguale_a: uguale };
    }
  }
  return { azione: "lasciato", motivo: "caricamento mai salvato, contenuto unico" };
}
