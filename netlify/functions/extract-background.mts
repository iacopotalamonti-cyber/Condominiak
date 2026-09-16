/// <reference types="@netlify/functions" />
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";

import "../../src/lib/websocket-polyfill";
import {
  CAMPI_IMPORTO,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  MAX_PAGES_PER_REQUEST,
  PAGINE_SOVRAPPOSTE,
  type ContestoEstrazione,
  type ExtractionMode,
  controlliBilancio,
  extractionPrompt,
  mergeExtractions,
  normalizeExtraction,
  parseExtractionOutput,
} from "../../src/lib/anthropic";
import type { ExtractedBilancio, ExtractionResult, UploadedFile } from "../../src/lib/types";

const BUCKET = "documenti-condominiali";

// I documenti caricati per l'estrazione restano consultabili: senza il PDF
// accanto al numero non c'è modo di verificare da dove arriva.
const PREFISSO_TEMPORANEO = "pending/";
const PREFISSO_ARCHIVIO = "documenti/";

// Le Background Function hanno 15 minuti: ci fermiamo prima per avere il tempo
// di salvare i risultati parziali invece di essere uccisi a metà lavoro.
const DEADLINE_MS = 13 * 60_000;

// Quante riletture mirate al massimo: ognuna è una richiesta in più, e serve
// solo dove i conti non tornano.
const MAX_RILETTURE = 3;

interface Piece {
  kind: "pdf" | "image";
  name: string;
  mediaType: string;
  data: Uint8Array;
  pages: number;
  offset: number;
  whole: boolean;
}

function label(piece: Piece): string {
  if (piece.whole) return piece.name;
  return `${piece.name} (pagine ${piece.offset + 1}-${piece.offset + piece.pages})`;
}

async function pdfSlice(
  source: PDFDocument,
  name: string,
  baseOffset: number,
  start: number,
  end: number
): Promise<Piece> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    source,
    Array.from({ length: end - start }, (_, i) => start + i)
  );
  for (const page of copied) out.addPage(page);

  return {
    kind: "pdf",
    name,
    mediaType: "application/pdf",
    data: await out.save(),
    pages: end - start,
    offset: baseOffset + start,
    whole: false,
  };
}

// Un PDF di molte pagine supera da solo il tetto di token per richiesta: viene
// spezzato in blocchi prima ancora di provarci. I blocchi si sovrappongono,
// perché un taglio netto cade regolarmente in mezzo a una tabella e ne fa
// leggere solo metà — con il subtotale di quella metà preso per totale.
async function piecesFor(file: UploadedFile, data: Uint8Array): Promise<Piece[]> {
  const whole: Piece = {
    kind: file.type === "application/pdf" ? "pdf" : "image",
    name: file.name,
    mediaType: file.type,
    data,
    pages: 1,
    offset: 0,
    whole: true,
  };

  if (whole.kind !== "pdf") return [whole];

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { ignoreEncryption: true });
  } catch (error) {
    // PDF che pdf-lib non sa aprire (firmato, malformato): lo mandiamo intero.
    console.warn(`Impossibile aprire ${file.name} per la divisione:`, error);
    return [whole];
  }

  const total = doc.getPageCount();
  if (total <= MAX_PAGES_PER_REQUEST) return [{ ...whole, pages: total }];

  const passo = Math.max(1, MAX_PAGES_PER_REQUEST - PAGINE_SOVRAPPOSTE);
  const pieces: Piece[] = [];
  for (let start = 0; start < total; start += passo) {
    const end = Math.min(start + MAX_PAGES_PER_REQUEST, total);
    pieces.push(await pdfSlice(doc, file.name, 0, start, end));
    if (end === total) break;
  }
  return pieces;
}

async function halve(piece: Piece): Promise<Piece[] | null> {
  if (piece.kind !== "pdf") return null;

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(piece.data, { ignoreEncryption: true });
  } catch {
    // Non divisibile: chi ha chiamato rilancia l'errore originale, che è più
    // utile di quello del parser.
    return null;
  }

  const total = doc.getPageCount();
  if (total < 2) return null;

  const mid = Math.floor(total / 2);
  return [
    await pdfSlice(doc, piece.name, piece.offset, 0, mid),
    await pdfSlice(doc, piece.name, piece.offset, mid, total),
  ];
}

function isTooLarge(error: unknown): boolean {
  if (error instanceof Anthropic.BadRequestError) {
    return /input_tokens_exceeded|too large|exceeds/i.test(error.message);
  }
  return error instanceof Anthropic.APIError && error.status === 413;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Il testo del PDF pagina per pagina, numerate come nel documento originale.
// È contro questo che si verifica ogni importo: il modello dice dove ha letto
// un numero, e qui si controlla che in quella pagina ci sia davvero.
// Un PDF scansionato non ha livello di testo e restituisce pagine vuote: in quel
// caso la verifica risulta impossibile, che è un esito diverso da "non trovato".
async function testoPerPagina(data: Uint8Array): Promise<Map<number, string>> {
  const pagine = new Map<number, string>();

  try {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: false });
    text.forEach((testo, indice) => {
      if (testo && testo.trim()) pagine.set(indice + 1, testo);
    });
  } catch (error) {
    // Senza testo si perde solo la verifica, non l'estrazione.
    console.warn("Estrazione del testo fallita, importi non verificabili:", error);
  }

  return pagine;
}

async function callModel(
  anthropic: Anthropic,
  piece: Piece,
  index: number,
  total: number,
  mode: ExtractionMode,
  testoPagine: Map<number, string>
): Promise<ExtractionResult> {
  const base64 = Buffer.from(piece.data).toString("base64");
  const block: Anthropic.ContentBlockParam =
    piece.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
          title: piece.name,
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: piece.mediaType as "image/jpeg" | "image/png" | "image/webp",
            data: base64,
          },
        };

  // Streaming perché l'input è un PDF intero e il ragionamento allunga il
  // turno: una richiesta non-stream rischierebbe il timeout HTTP.
  const message = await anthropic.messages
    .stream({
      model: EXTRACTION_MODEL,
      max_tokens: EXTRACTION_MAX_TOKENS,
      // Leggere una tabella e ricondurre le voci alle categorie è lavoro di
      // ragionamento: senza, gli errori di attribuzione aumentano.
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [
        {
          role: "user",
          content: [block, { type: "text", text: extractionPrompt(label(piece), index, total, mode) }],
        },
      ],
    })
    .finalMessage();

  if (message.stop_reason === "max_tokens") {
    throw new Error("risposta troncata, documento troppo denso");
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const ctx: ContestoEstrazione = {
    documento: piece.name,
    // Il modello numera le pagine a partire da quelle che riceve: senza
    // l'offset la fonte rimanderebbe alla pagina sbagliata del PDF.
    offsetPagina: piece.offset,
    testoPagine,
  };

  return normalizeExtraction(parseExtractionOutput(text), ctx);
}

// Il tetto di token per richiesta dipende dal tier dell'account e non è noto
// qui: se un blocco lo supera comunque, lo si dimezza e si riprova finché non
// entra.
async function analyzePiece(
  anthropic: Anthropic,
  piece: Piece,
  index: number,
  total: number,
  mode: ExtractionMode,
  testoPagine: Map<number, string>
): Promise<ExtractionResult[]> {
  try {
    return [await callModel(anthropic, piece, index, total, mode, testoPagine)];
  } catch (error) {
    if (!isTooLarge(error)) throw error;

    const halves = await halve(piece);
    if (!halves) throw error;

    console.log(`Blocco oltre il limite di token, lo divido: ${label(piece)}`);
    const results: ExtractionResult[] = [];
    for (const half of halves) {
      results.push(...(await analyzePiece(anthropic, half, index, total, mode, testoPagine)));
    }
    return results;
  }
}

// Le pagine da cui vengono gli importi di un bilancio, dentro un documento.
function paginePerDocumento(bilancio: ExtractedBilancio): Map<string, number[]> {
  const perDocumento = new Map<string, number[]>();

  for (const campo of CAMPI_IMPORTO) {
    const fonte = bilancio.fonti[campo];
    if (!fonte?.pagina) continue;
    const pagine = perDocumento.get(fonte.documento) ?? [];
    pagine.push(fonte.pagina);
    perDocumento.set(fonte.documento, pagine);
  }

  return perDocumento;
}

// Quando i conti di un esercizio non tornano, la causa più frequente è una
// tabella letta a metà. Invece di arrendersi si rilegge una volta sola il
// tratto di documento da cui vengono quegli importi, questa volta intero.
async function rileggiBilancio(
  anthropic: Anthropic,
  bilancio: ExtractedBilancio,
  documenti: Map<string, { doc: PDFDocument; pagine: number; testo: Map<number, string> }>,
  mode: ExtractionMode
): Promise<ExtractionResult | null> {
  for (const [nome, pagine] of paginePerDocumento(bilancio)) {
    const sorgente = documenti.get(nome);
    if (!sorgente) continue;

    // Una pagina di margine per prendere l'intestazione della tabella e la
    // riga del totale, che spesso cadono appena fuori.
    const da = Math.max(0, Math.min(...pagine) - 2);
    const a = Math.min(sorgente.pagine, Math.max(...pagine) + 1);
    if (a - da < 1 || a - da > MAX_PAGES_PER_REQUEST) continue;

    const piece = await pdfSlice(sorgente.doc, nome, 0, da, a);
    console.log(`Rilettura mirata di ${label(piece)} per l'esercizio ${bilancio.anno}`);
    return await callModel(anthropic, piece, 1, 1, mode, sorgente.testo);
  }

  return null;
}

function riepilogoControlli(bilanci: ExtractedBilancio[]): string {
  const righe: string[] = [];

  for (const bilancio of bilanci) {
    for (const controllo of controlliBilancio(bilancio)) {
      if (controllo.livello !== "errore") continue;
      righe.push(`${bilancio.anno || "anno non riconosciuto"}: ${controllo.messaggio}`);
    }
  }

  return righe.join(" ");
}

// Documenti reali multi-pagina possono richiedere 40-90+ secondi con Claude,
// ben oltre il limite delle funzioni serverless sincrone (10-26s). Le
// Background Function di Netlify hanno 15 minuti a disposizione: qui gira
// la chiamata vera e propria. I file arrivano come percorsi Supabase Storage
// (non come byte, per non sbattere contro il limite di payload di una
// funzione sincrona) e vengono scaricati qui con la service role key. Il
// risultato finisce su Netlify Blobs, dove /api/extract-status lo legge
// via polling.
//
// Nota: in questo formato di funzione Netlify le variabili d'ambiente NON
// arrivano affidabilmente via process.env — vanno lette con Netlify.env.get.
export default async (req: Request) => {
  const { jobId, files, mode = "condominio" } = (await req.json()) as {
    jobId: string;
    files: UploadedFile[];
    mode?: ExtractionMode;
  };
  console.log(`extract-background invoked: jobId=${jobId}, files=${files.length}, mode=${mode}`);
  console.log(`env check: url=${Boolean(Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"))} key=${Boolean(Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"))} anthropic=${Boolean(Netlify.env.get("ANTHROPIC_API_KEY"))}`);
  const store = getStore("extractions");
  const deadline = Date.now() + DEADLINE_MS;

  try {
    const supabaseUrl = Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Netlify.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
      const missing = [
        !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
        !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
        !anthropicApiKey && "ANTHROPIC_API_KEY",
      ].filter(Boolean);
      throw new Error(`Variabili d'ambiente mancanti: ${missing.join(", ")}`);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
      timeout: 4 * 60_000,
      maxRetries: 2,
    });

    const pieces: Piece[] = [];
    // I PDF aperti e il loro testo restano a disposizione per la verifica degli
    // importi e per le eventuali riletture mirate.
    const sorgenti = new Map<string, { doc: PDFDocument; pagine: number; testo: Map<number, string> }>();
    const testoDocumenti = new Map<string, Map<number, string>>();

    for (const file of files) {
      const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
      if (error || !data) {
        throw new Error(`Download fallito per ${file.name}: ${error?.message ?? "sconosciuto"}`);
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      pieces.push(...(await piecesFor(file, bytes)));

      if (file.type === "application/pdf") {
        const testo = await testoPerPagina(bytes);
        testoDocumenti.set(file.name, testo);
        if (!testo.size) {
          console.warn(`${file.name} non ha un livello di testo: importi non verificabili`);
        }
        try {
          const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          sorgenti.set(file.name, { doc, pagine: doc.getPageCount(), testo });
        } catch {
          // Già segnalato da piecesFor: senza sorgente si salta la rilettura.
        }
      }
    }

    console.log(`${files.length} documenti divisi in ${pieces.length} blocchi da analizzare`);

    const results: ExtractionResult[] = [];
    const failures: string[] = [];

    for (const [index, piece] of pieces.entries()) {
      if (Date.now() > deadline) {
        failures.push(`tempo massimo raggiunto, ${pieces.length - index} blocchi non analizzati`);
        break;
      }

      await store.setJSON(jobId, {
        status: "running",
        progress: { fatti: index, totale: pieces.length, documento: label(piece) },
      });

      try {
        results.push(
          ...(await analyzePiece(
            anthropic,
            piece,
            index + 1,
            pieces.length,
            mode,
            testoDocumenti.get(piece.name) ?? new Map()
          ))
        );
      } catch (error) {
        // Un documento illeggibile non deve buttare via quelli già estratti.
        console.error(`Estrazione fallita per ${label(piece)}:`, error);
        failures.push(`${label(piece)} — ${messageOf(error)}`);
      }
    }

    if (!results.length) {
      throw new Error(failures[0] ?? "Nessun dato estratto dai documenti");
    }

    let extracted = mergeExtractions(results);

    // Seconda passata solo sugli esercizi che non quadrano. Le riletture
    // vengono messe per prime nella fusione, così a parità di fonte vince la
    // lettura fatta sulla tabella intera e l'altra resta come conflitto.
    const daRileggere = extracted.bilanci.filter((b) =>
      controlliBilancio(b).some((c) => c.livello === "errore" && c.campo !== "")
    );

    const riletture: ExtractionResult[] = [];
    for (const bilancio of daRileggere.slice(0, MAX_RILETTURE)) {
      if (Date.now() > deadline) break;
      await store.setJSON(jobId, {
        status: "running",
        progress: {
          fatti: pieces.length,
          totale: pieces.length,
          documento: `verifica dei conti dell'esercizio ${bilancio.anno || "?"}`,
        },
      });
      try {
        const rilettura = await rileggiBilancio(anthropic, bilancio, sorgenti, mode);
        if (rilettura) riletture.push(rilettura);
      } catch (error) {
        console.error(`Rilettura fallita per l'esercizio ${bilancio.anno}:`, error);
      }
    }

    if (riletture.length) extracted = mergeExtractions([...riletture, extracted]);

    // I file restano archiviati: la provenienza di un importo serve a poco se
    // il documento a cui rimanda è stato cancellato.
    const archiviati: UploadedFile[] = [];
    for (const file of files) {
      const destinazione = file.path.startsWith(PREFISSO_TEMPORANEO)
        ? PREFISSO_ARCHIVIO + file.path.slice(PREFISSO_TEMPORANEO.length)
        : file.path;

      if (destinazione !== file.path) {
        const { error } = await supabase.storage.from(BUCKET).move(file.path, destinazione);
        if (error) {
          console.warn(`Archiviazione fallita per ${file.name}:`, error.message);
          archiviati.push(file);
          continue;
        }
      }
      archiviati.push({ ...file, path: destinazione });
    }
    extracted.documenti = archiviati;

    const problemi = riepilogoControlli(extracted.bilanci);
    extracted.note = [
      extracted.note,
      problemi && `Da verificare: ${problemi}`,
      failures.length && `Non analizzati: ${failures.join("; ")}.`,
    ]
      .filter(Boolean)
      .join(" ");

    await store.setJSON(jobId, { status: "done", data: extracted });
  } catch (error) {
    console.error("Background extraction error:", error);
    await store.setJSON(jobId, { status: "error", error: messageOf(error) });
  }
};
