/// <reference types="@netlify/functions" />
import { getStore } from "@netlify/blobs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";

import "../../src/lib/websocket-polyfill";
import {
  CAMPI_IMPORTO,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  effortValido,
  MAX_PAGES_PER_REQUEST,
  PAGINE_SOVRAPPOSTE,
  type ContestoEstrazione,
  type ExtractionMode,
  controlliBilancio,
  emptyExtraction,
  extractionPrompt,
  pagineDiRiparto,
  promptCorrezione,
  sommaSpese,
  mergeExtractions,
  normalizeExtraction,
  parseExtractionOutput,
} from "../../src/lib/anthropic";
import * as Sentry from "@sentry/node";
import { riconciliaBilancio, spiegaRiconciliazione } from "../../src/lib/riconciliazione";
import {
  estrazioneDa,
  leggiRendiconto,
  notaDiLettura,
  pagineDi,
  type RendicontoLetto,
  type SchedaApprovata,
} from "../../src/lib/lettura";
import type { ExtractedBilancio, ExtractionResult, UploadedFile } from "../../src/lib/types";
import { riconosci } from "../../src/lib/motore";
import { PROFILI } from "../../src/lib/profili";
import { proponiScheda } from "../../src/lib/proposta-scheda";
import type { Pagina } from "../../src/lib/rendiconto";
import { validaProposta } from "../../src/lib/scheda";
import { condominiDi } from "../../src/lib/appartenenza";
import { BUCKET, eUuid, puoEstrarre } from "../../src/lib/percorsi";

// Un rendiconto per esercizio, qualche anno alla volta: oltre è un errore o
// un abuso, e ogni file è una o più chiamate al modello.
const MAX_FILE = 12;

// Le Background Function hanno 15 minuti: ci fermiamo prima per avere il tempo
// di salvare i risultati parziali invece di essere uccisi a metà lavoro.
const DEADLINE_MS = 13 * 60_000;

// Una proposta di scheda sono una o due chiamate al modello su un testo lungo:
// si parte solo con almeno questo margine prima della scadenza.
const MARGINE_PROPOSTA_MS = 4 * 60_000;

// Quante riletture mirate al massimo: ognuna è una richiesta in più, e serve
// solo dove i conti non tornano.
const MAX_RILETTURE = 3;

// Un rendiconto di formato conosciuto si legge qui, senza chiamare nessuno.
// Se la lettura quadra al centesimo con il totale che il documento stampa, è
// migliore di qualunque estrazione: costa zero, non varia fra due tentativi, e
// si è già verificata da sola.
async function letturaLibera(
  bytes: Uint8Array,
  nome: string,
  approvate: SchedaApprovata[]
): Promise<{ pagine: Pagina[] | null; letto: RendicontoLetto | null }> {
  try {
    const pagine = await pagineDi(bytes);
    return { pagine, letto: leggiRendiconto(pagine, approvate) };
  } catch (error) {
    // Un PDF che non si lascia aprire qui si lascia comunque mandare al
    // modello: la lettura è una scorciatoia, non un passaggio obbligato.
    console.warn(`Lettura diretta fallita per ${nome}:`, error);
    return { pagine: null, letto: null };
  }
}

// Le schede che il motore usa oltre a quelle scritte nel codice. Si
// rivalidano anche se sono già state approvate: una riga modificata a mano nel
// database non deve poter dare al motore un'espressione che non passerebbe.
async function schedeDa(supabase: SupabaseClient, stato: "approvata" | "proposta"): Promise<SchedaApprovata[]> {
  const { data, error } = await supabase
    .from("schede_formato")
    .select("nome, scheda, mappatura")
    .eq("stato", stato)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(`Schede di formato (${stato}) non lette:`, error.message);
    return [];
  }
  const riservati = PROFILI.map((p) => p.nome);
  return (data ?? []).flatMap((riga) => {
    const { proposta, errori } = validaProposta({ scheda: riga.scheda, mappatura: riga.mappatura }, riservati);
    if (!proposta) console.warn(`Scheda "${riga.nome}" scartata: ${errori.join("; ")}`);
    return proposta ? [proposta] : [];
  });
}

// Un formato che non conosciamo: si chiede al modello una scheda, la si prova
// sul documento, e se regge la si mette in attesa di approvazione. Il
// documento di adesso lo legge comunque il modello, come sempre: la scheda
// serve dal prossimo.
async function proponiPer(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  pagine: Pagina[],
  documento: string,
  utente: string,
  approvate: SchedaApprovata[]
): Promise<string> {
  const inAttesa = await schedeDa(supabase, "proposta");
  const giaProposta = riconosci(pagine, inAttesa.map((p) => p.scheda));
  if (giaProposta) {
    return `${documento}: formato nuovo, la sua scheda ("${giaProposta.nome}") aspetta già l'approvazione.`;
  }

  const { model, effort } = configurazioneModello();
  const riservati = [...PROFILI, ...approvate.map((a) => a.scheda)].map((p) => p.nome);
  const esito = await proponiScheda(
    pagine,
    async (conversazione) => {
      const message = await anthropic.messages
        .stream({
          model,
          max_tokens: EXTRACTION_MAX_TOKENS,
          thinking: { type: "adaptive" },
          output_config: { effort },
          messages: conversazione.map((testo, i) => ({
            role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
            content: testo,
          })),
        })
        .finalMessage();
      console.log(
        `Proposta di scheda per ${documento}: ${message.usage.input_tokens} token in ingresso, ` +
          `${message.usage.output_tokens} in uscita`
      );
      return message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
    riservati
  );

  if (!esito.proposta || !esito.verifica?.utilizzabile) {
    console.warn(`Nessuna scheda utilizzabile per ${documento}: ${esito.problemi.join("; ")}`);
    return "";
  }

  const { error } = await supabase.from("schede_formato").insert({
    nome: esito.proposta.scheda.nome,
    scheda: esito.proposta.scheda,
    mappatura: { voci: esito.proposta.mappatura.voci, personali: esito.proposta.mappatura.personali },
    verifica: esito.verifica,
    documento_nome: documento,
    proposta_da: utente,
  });
  if (error) {
    console.error(`Scheda per ${documento} non salvata:`, error.message);
    return "";
  }
  return (
    `${documento}: formato nuovo ("${esito.proposta.scheda.nome}"). Il modello ne ha proposto la scheda, ` +
    `che rilegge il documento in quadratura con il totale stampato: una volta approvata, i prossimi ` +
    `rendiconti di questo formato si leggeranno senza modello.`
  );
}

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

// Modello ed effort sono la leva di costo principale: sovrascrivibili senza
// toccare il codice, così provare un modello più economico non costa un deploy.
function configurazioneModello() {
  return {
    model: Netlify.env.get("EXTRACTION_MODEL") ?? EXTRACTION_MODEL,
    effort: effortValido(Netlify.env.get("EXTRACTION_EFFORT")),
  };
}

async function callModel(
  anthropic: Anthropic,
  piece: Piece,
  index: number,
  total: number,
  mode: ExtractionMode,
  testoPagine: Map<number, string>,
  correzione = ""
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
  const { model, effort } = configurazioneModello();

  const message = await anthropic.messages
    .stream({
      model,
      max_tokens: EXTRACTION_MAX_TOKENS,
      // Leggere una tabella e ricondurre le voci alle categorie è lavoro di
      // ragionamento: senza, gli errori di attribuzione aumentano.
      thinking: { type: "adaptive" },
      output_config: { effort },
      messages: [
        {
          role: "user",
          content: [
            block,
            {
              type: "text",
              text:
                extractionPrompt(
                  label(piece),
                  index,
                  total,
                  mode,
                  // Le pagine vanno rinumerate come le vede il modello in
                  // questo blocco, non come stanno nel documento intero.
                  pagineDiRiparto(testoPagine)
                    .filter((p) => p > piece.offset && p <= piece.offset + piece.pages)
                    .map((p) => p - piece.offset)
                ) + correzione,
            },
          ],
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

  const risultato = normalizeExtraction(parseExtractionOutput(text), ctx);
  risultato.uso = {
    chiamate: 1,
    tokenIngresso:
      (message.usage.input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0) +
      (message.usage.cache_creation_input_tokens ?? 0),
    tokenUscita: message.usage.output_tokens ?? 0,
  };

  return risultato;
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
  // Lo scarto fra le voci lette e il totale stampato è l'unica informazione
  // che il modello non poteva avere alla prima passata: nasce dal confronto
  // fra la sua risposta e il documento. Ripetere il prompt identico, come
  // faceva prima, otteneva lo stesso risultato.
  const riferimento = bilancio.totale || bilancio.cons;
  const somma = sommaSpese(bilancio.spese);
  for (const [nome, pagine] of paginePerDocumento(bilancio)) {
    const sorgente = documenti.get(nome);
    if (!sorgente) continue;

    // Una pagina di margine per prendere l'intestazione della tabella e la
    // riga del totale, che spesso cadono appena fuori.
    const da = Math.max(0, Math.min(...pagine) - 2);
    const a = Math.min(sorgente.pagine, Math.max(...pagine) + 1);
    if (a - da < 1 || a - da > MAX_PAGES_PER_REQUEST) continue;


    const riparto = pagineDiRiparto(sorgente.testo)
      .filter((p) => p > da && p <= a)
      .map((p) => p - da);

    const correzione = riferimento && somma ? promptCorrezione(somma, riferimento, riparto) : "";

    const piece = await pdfSlice(sorgente.doc, nome, 0, da, a);
    console.log(
      `Rilettura correttiva di ${label(piece)} per l'esercizio ${bilancio.anno}: ` +
        `voci ${somma} contro totale ${riferimento}`
    );
    return await callModel(anthropic, piece, 1, 1, mode, sorgente.testo, correzione);
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
  const corpo = (await req.json().catch(() => null)) as {
    jobId?: unknown;
    files?: unknown;
    mode?: ExtractionMode;
  } | null;
  const jobId = typeof corpo?.jobId === "string" ? corpo.jobId : "";
  const files = (Array.isArray(corpo?.files) ? corpo.files : []) as UploadedFile[];
  const mode = corpo?.mode ?? "condominio";

  // Una Background Function risponde 202 prima di cominciare: un rifiuto non
  // arriva a chi chiama come stato HTTP, ma solo come esito del lavoro.
  if (!eUuid(jobId) || !files.length || files.length > MAX_FILE || files.some((f) => typeof f?.path !== "string")) {
    console.warn("extract-background: richiesta malformata, ignorata");
    return;
  }
  console.log(`extract-background invoked: jobId=${jobId}, files=${files.length}, mode=${mode}`);
  console.log(`env check: url=${Boolean(Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"))} key=${Boolean(Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"))} anthropic=${Boolean(Netlify.env.get("ANTHROPIC_API_KEY"))}`);
  // L'estrazione è il punto dove un errore resta invisibile: gira in
  // background, l'utente vede solo un lavoro che non finisce mai. Qui le
  // variabili non arrivano da process.env (vedi la nota sopra).
  const sentryDsn = Netlify.env.get("NEXT_PUBLIC_SENTRY_DSN");
  if (sentryDsn && !Sentry.isInitialized()) {
    Sentry.init({
      dsn: sentryDsn,
      environment: Netlify.env.get("CONTEXT") ?? "unknown",
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  }

  const store = getStore("extractions");
  const deadline = Date.now() + DEADLINE_MS;
  // Lo stato del lavoro lo legge solo chi l'ha avviato: il risultato contiene
  // i numeri del condominio. Finché non si sa chi è, resta vuoto.
  let proprietario: string | null = null;
  const salva = (stato: Record<string, unknown>) =>
    store.setJSON(jobId, { ...stato, owner: proprietario });

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

    // Prima di scaricare un solo byte o spendere una chiamata al modello: chi
    // chiede, e se quei file può farli leggere. Senza questo controllo
    // chiunque conoscesse l'indirizzo della funzione poteva far analizzare,
    // a spese del condominio, qualunque percorso del bucket.
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const {
      data: { user },
    } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!user) {
      console.warn(`extract-background: jobId=${jobId} senza una sessione valida, ignorato`);
      return;
    }
    // Il jobId lo sceglie il browser: se esiste già è di un altro lavoro, e
    // non va sovrascritto.
    if (await store.get(jobId)) {
      console.warn(`extract-background: jobId=${jobId} già in uso, ignorato`);
      return;
    }
    proprietario = user.id;

    const { admin } = await condominiDi(supabase, user.id);
    const vietati = files.filter((f) => !puoEstrarre(f.path, user.id, admin));
    if (vietati.length) {
      console.warn(`extract-background: ${user.id} ha chiesto ${vietati.length} file non suoi`);
      throw new Error("Non puoi far analizzare questi documenti: non sono tuoi né di un condominio che amministri.");
    }
    // L'AI Gateway di Netlify si inserisce da solo negli SDK supportati dentro
    // le funzioni e fattura l'inferenza sui crediti del piano — lo stesso monte
    // che paga l'hosting. È già successo: 6,15 $ di inferenza sono costati
    // 1.106 crediti e hanno messo offline il sito. Un baseURL esplicito ha la
    // precedenza sulla configurazione iniettata, quindi le chiamate tornano su
    // Anthropic, dove la spesa è visibile e non può spegnere il condominio.
    // Resta sovrascrivibile da variabile d'ambiente, per tornare indietro senza
    // un rilascio.
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
      baseURL: Netlify.env.get("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com",
      timeout: 4 * 60_000,
      maxRetries: 2,
    });

    const pieces: Piece[] = [];
    // I PDF aperti e il loro testo restano a disposizione per la verifica degli
    // importi e per le eventuali riletture mirate.
    const sorgenti = new Map<string, { doc: PDFDocument; pagine: number; testo: Map<number, string> }>();
    const testoDocumenti = new Map<string, Map<number, string>>();
    // I documenti che abbiamo saputo leggere da soli, e la riga che lo spiega.
    const letture: { file: UploadedFile; letto: RendicontoLetto }[] = [];
    const noteLettura: string[] = [];
    // I PDF con testo di un formato che nessuna scheda riconosce.
    const sconosciuti: { file: UploadedFile; pagine: Pagina[] }[] = [];
    const approvate = await schedeDa(supabase, "approvata");

    for (const file of files) {
      const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
      if (error || !data) {
        throw new Error(`Download fallito per ${file.name}: ${error?.message ?? "sconosciuto"}`);
      }
      const bytes = new Uint8Array(await data.arrayBuffer());

      if (file.type === "application/pdf") {
        const { pagine, letto } = await letturaLibera(bytes, file.name, approvate);
        if (!letto && pagine && pagine.some((p) => p.righe.length > 10)) {
          sconosciuti.push({ file, pagine });
        }

        if (letto && !letto.motivo) {
          letture.push({ file, letto });
          noteLettura.push(notaDiLettura(letto));
          console.log(`${file.name}: ${notaDiLettura(letto)}`);

          // Quando si sta aggiungendo un bilancio, la lettura è tutto ciò che
          // serve e il documento non va nemmeno mandato. In fase di
          // registrazione del condominio invece il rendiconto porta anche
          // l'indirizzo, le unità e i millesimi, che il motore non legge: il
          // documento parte lo stesso, e in fondo i conti letti prendono il
          // posto di quelli estratti.
          if (mode === "bilancio") continue;
        } else if (letto) {
          const avviso =
            `${file.name}: formato ${letto.formato} riconosciuto, ma la lettura non è ` +
            `utilizzabile (${letto.motivo}). Lo legge il modello.`;
          noteLettura.push(avviso);
          console.warn(avviso);
        }
      }

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

    console.log(
      `${files.length} documenti: ${letture.length} letti direttamente, ` +
        `${pieces.length} blocchi da analizzare`
    );

    const results: ExtractionResult[] = [];
    const failures: string[] = [];

    for (const [index, piece] of pieces.entries()) {
      if (Date.now() > deadline) {
        failures.push(`tempo massimo raggiunto, ${pieces.length - index} blocchi non analizzati`);
        break;
      }

      await salva({
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

    if (!results.length && !letture.length) {
      throw new Error(failures[0] ?? "Nessun dato estratto dai documenti");
    }

    let extracted = results.length ? mergeExtractions(results) : emptyExtraction();

    // Prima di rileggere a pagamento: la riconciliazione è aritmetica, gira in
    // locale e costa zero. Il totale stampato sul documento fa da arbitro su
    // quali righe sono spese vere e quali sono la loro eco dentro i prospetti
    // di riparto. Quello che si aggiusta qui non va chiesto di nuovo al
    // modello.
    const noteRiconciliazione: string[] = [];
    extracted.bilanci = extracted.bilanci.map((bilancio) => {
      // Le pagine sono numerate per documento: passare quelle di riparto ha
      // senso solo se i movimenti di questo esercizio vengono da un documento
      // solo. Negli altri casi decide il confronto col totale, che non si
      // lascia ingannare da una numerazione mescolata.
      const documenti = new Set(
        bilancio.movimenti.map((m) => m.fonte?.documento).filter(Boolean) as string[]
      );
      const sorgente = documenti.size === 1 ? testoDocumenti.get([...documenti][0]) : undefined;
      const riparto = sorgente ? pagineDiRiparto(sorgente) : [];

      const esito = riconciliaBilancio(bilancio, riparto);
      const spiegazione = spiegaRiconciliazione(bilancio.anno, esito.riconciliazione);
      if (spiegazione) {
        noteRiconciliazione.push(spiegazione);
        console.log(spiegazione);
      }
      return esito.bilancio;
    });

    // Un esercizio letto dal motore non si discute: quadra al centesimo con il
    // totale stampato, e quello estratto dal modello per lo stesso anno viene
    // sostituito, non fuso. Fondere ricalcolerebbe i totali di categoria sui
    // movimenti messi insieme dalle due letture, e il risultato non sarebbe più
    // quello di nessuna delle due.
    if (letture.length) {
      const letti = letture.map(({ file, letto }) => estrazioneDa(letto, file.name));
      const anniLetti = new Set(letti.map((b) => b.anno));
      extracted.bilanci = [...letti, ...extracted.bilanci.filter((b) => !anniLetti.has(b.anno))].sort(
        (x, y) => y.anno - x.anno
      );
      extracted.confidence.bilanci = 1;
      extracted.confidence.spese = 1;
    }

    // Seconda passata solo sugli esercizi che non quadrano. Le riletture
    // vengono messe per prime nella fusione, così a parità di fonte vince la
    // lettura fatta sulla tabella intera e l'altra resta come conflitto.
    const daRileggere = extracted.bilanci.filter((b) =>
      controlliBilancio(b).some((c) => c.livello === "errore" && c.campo !== "")
    );

    const riletture: ExtractionResult[] = [];
    for (const bilancio of daRileggere.slice(0, MAX_RILETTURE)) {
      if (Date.now() > deadline) break;
      await salva({
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

    // I file restano dove sono stati caricati: entrano nell'archivio del
    // condominio quando i loro numeri vengono salvati, non prima. Un'analisi
    // abbandonata non lascia niente nell'archivio.
    extracted.documenti = files;

    // Le proposte di scheda vengono dopo l'estrazione, e solo se resta tempo:
    // l'utente aspetta i suoi numeri, non la scheda.
    for (const { file, pagine } of sconosciuti) {
      if (Date.now() > deadline - MARGINE_PROPOSTA_MS) break;
      await salva({
        status: "running",
        progress: { fatti: pieces.length, totale: pieces.length, documento: `scheda del formato di ${file.name}` },
      });
      try {
        const nota = await proponiPer(anthropic, supabase, pagine, file.name, proprietario!, approvate);
        if (nota) noteLettura.push(nota);
      } catch (error) {
        // Una proposta fallita non tocca l'estrazione, che è già fatta.
        console.error(`Proposta di scheda fallita per ${file.name}:`, error);
        Sentry.captureException(error, { tags: { jobId, fase: "proposta-scheda" } });
      }
    }

    const problemi = riepilogoControlli(extracted.bilanci);
    extracted.note = [
      ...noteLettura,
      ...noteRiconciliazione,
      extracted.note,
      problemi && `Da verificare: ${problemi}`,
      failures.length && `Non analizzati: ${failures.join("; ")}.`,
    ]
      .filter(Boolean)
      .join(" ");

    console.log(
      `Estrazione completata: ${extracted.uso.chiamate} chiamate a ${configurazioneModello().model}, ` +
        `${extracted.uso.tokenIngresso} token in ingresso, ${extracted.uso.tokenUscita} in uscita` +
        (letture.length ? `, ${letture.length} documenti letti senza modello` : "")
    );

    await salva({ status: "done", data: extracted });
  } catch (error) {
    console.error("Background extraction error:", error);
    // Il jobId permette di ritrovare nei log della funzione l'estrazione
    // esatta a cui l'errore appartiene.
    Sentry.captureException(error, { tags: { jobId, mode } });
    // La funzione termina subito dopo: senza flush l'evento non parte.
    await Sentry.flush(2000).catch(() => {});
    await salva({ status: "error", error: messageOf(error) });
  }
};
