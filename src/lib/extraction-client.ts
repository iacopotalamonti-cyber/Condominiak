import { createClient } from "@/lib/supabase/client";
import type { ExtractionMode } from "@/lib/anthropic";
import type { ExtractionResult, UploadedFile } from "@/lib/types";

export const BUCKET = "documenti-condominiali";
export const TIPI_ACCETTATI = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const POLL_INTERVAL_MS = 3000;

// I documenti vengono analizzati uno alla volta: con più file l'attesa cresce,
// e la Background Function ha comunque 15 minuti di budget.
const TIMEOUT_MS = 14 * 60_000;

// Il browser carica direttamente su Supabase Storage: passando dalle funzioni
// serverless si sbatterebbe contro il limite di payload di Netlify (6MB).
export async function caricaSuStorage(files: File[]): Promise<UploadedFile[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessione scaduta, ricarica la pagina");

  const caricati: UploadedFile[] = [];
  for (const file of files) {
    const path = `pending/${user.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (error) throw error;
    caricati.push({ name: file.name, type: file.type, path });
  }
  return caricati;
}

export async function analizzaDocumenti(
  files: UploadedFile[],
  mode: ExtractionMode,
  onProgress?: (stato: string) => void
): Promise<ExtractionResult> {
  const jobId = crypto.randomUUID();

  // Chiamata diretta dal browser alla Background Function: evitiamo che una
  // funzione serverless ne chiami un'altra internamente (chiamata
  // funzione-a-funzione, inaffidabile nel sandbox di Netlify).
  const startRes = await fetch("/.netlify/functions/extract-background", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, files, mode }),
  });
  if (!startRes.ok) throw new Error(`Avvio elaborazione fallito (status ${startRes.status})`);

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusRes = await fetch(`/api/extract-status?jobId=${encodeURIComponent(jobId)}`);
    const statusJson = await statusRes.json();

    if (statusJson.done && !statusJson.success) {
      throw new Error(statusJson.error || "Estrazione fallita");
    }
    if (statusJson.done) return statusJson.data as ExtractionResult;

    if (statusJson.progress) {
      const { fatti, totale, documento } = statusJson.progress;
      onProgress?.(`Documento ${fatti + 1} di ${totale}: ${documento}`);
    }
  }

  throw new Error("Tempo massimo di attesa superato, riprova");
}

// Gli errori di API e SDK arrivano come JSON grezzo: mostrarli tali e quali
// all'amministratore non gli dice nulla su cosa fare.
export function messaggioErrore(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/input_tokens_exceeded|too large|413/i.test(raw)) {
    return "I documenti sono troppo voluminosi per essere analizzati: riprova caricandone meno alla volta.";
  }
  if (/rate_limit|429/i.test(raw)) {
    return "Il servizio AI è momentaneamente sovraccarico: riprova tra qualche minuto.";
  }
  if (/tempo massimo|timeout|ETIMEDOUT/i.test(raw)) {
    return "L'analisi ha superato il tempo massimo: riprova con meno documenti o con file più leggeri.";
  }
  // I nomi delle variabili non sono un segreto, i loro valori sì: dirli
  // trasforma la prossima segnalazione in una diagnosi invece che in un giro
  // di domande.
  const mancanti = raw.match(/Variabili d'ambiente mancanti:\s*(.+)/i);
  if (mancanti) {
    return `Configurazione del server incompleta: manca ${mancanti[1].trim()}. Va impostata fra le variabili d'ambiente del sito, poi serve un nuovo deploy.`;
  }

  return raw || "Errore sconosciuto";
}
