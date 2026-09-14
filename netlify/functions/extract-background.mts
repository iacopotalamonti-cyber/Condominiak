/// <reference types="@netlify/functions" />
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

import "../../src/lib/websocket-polyfill";
import {
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  MAX_PAGES_PER_REQUEST,
  extractionPrompt,
  mergeExtractions,
  normalizeExtraction,
  parseExtractionOutput,
} from "../../src/lib/anthropic";
import type { ExtractionResult, UploadedFile } from "../../src/lib/types";

const BUCKET = "documenti-condominiali";

// Le Background Function hanno 15 minuti: ci fermiamo prima per avere il tempo
// di salvare i risultati parziali invece di essere uccisi a metà lavoro.
const DEADLINE_MS = 13 * 60_000;

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
// spezzato in blocchi prima ancora di provarci.
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

  const pieces: Piece[] = [];
  for (let start = 0; start < total; start += MAX_PAGES_PER_REQUEST) {
    pieces.push(
      await pdfSlice(doc, file.name, 0, start, Math.min(start + MAX_PAGES_PER_REQUEST, total))
    );
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

async function callModel(
  anthropic: Anthropic,
  piece: Piece,
  index: number,
  total: number
): Promise<ExtractionResult> {
  const base64 = Buffer.from(piece.data).toString("base64");
  const block: Anthropic.ContentBlockParam =
    piece.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: piece.mediaType as "image/jpeg" | "image/png" | "image/webp",
            data: base64,
          },
        };

  const message = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: EXTRACTION_MAX_TOKENS,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [block, { type: "text", text: extractionPrompt(label(piece), index, total) }],
      },
    ],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("risposta troncata, documento troppo denso");
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return normalizeExtraction(parseExtractionOutput(text));
}

// Il tetto di token per richiesta dipende dal tier dell'account e non è noto
// qui: se un blocco lo supera comunque, lo si dimezza e si riprova finché non
// entra.
async function analyzePiece(
  anthropic: Anthropic,
  piece: Piece,
  index: number,
  total: number
): Promise<ExtractionResult[]> {
  try {
    return [await callModel(anthropic, piece, index, total)];
  } catch (error) {
    if (!isTooLarge(error)) throw error;

    const halves = await halve(piece);
    if (!halves) throw error;

    console.log(`Blocco oltre il limite di token, lo divido: ${label(piece)}`);
    const results: ExtractionResult[] = [];
    for (const half of halves) {
      results.push(...(await analyzePiece(anthropic, half, index, total)));
    }
    return results;
  }
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
  const { jobId, files } = (await req.json()) as { jobId: string; files: UploadedFile[] };
  console.log(`extract-background invoked: jobId=${jobId}, files=${files.length}`);
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
    for (const file of files) {
      const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
      if (error || !data) {
        throw new Error(`Download fallito per ${file.name}: ${error?.message ?? "sconosciuto"}`);
      }
      pieces.push(...(await piecesFor(file, new Uint8Array(await data.arrayBuffer()))));
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
        results.push(...(await analyzePiece(anthropic, piece, index + 1, pieces.length)));
      } catch (error) {
        // Un documento illeggibile non deve buttare via quelli già estratti.
        console.error(`Estrazione fallita per ${label(piece)}:`, error);
        failures.push(`${label(piece)} — ${messageOf(error)}`);
      }
    }

    if (!results.length) {
      throw new Error(failures[0] ?? "Nessun dato estratto dai documenti");
    }

    const extracted = mergeExtractions(results);
    if (failures.length) {
      extracted.note = [extracted.note, `Non analizzati: ${failures.join("; ")}.`]
        .filter(Boolean)
        .join(" ");
    }

    await store.setJSON(jobId, { status: "done", data: extracted });

    // Pulizia: i file temporanei non servono più una volta estratti.
    await supabase.storage.from(BUCKET).remove(files.map((f) => f.path));
  } catch (error) {
    console.error("Background extraction error:", error);
    await store.setJSON(jobId, { status: "error", error: messageOf(error) });
  }
};
