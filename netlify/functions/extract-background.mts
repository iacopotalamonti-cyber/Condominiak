import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

import { EXTRACTION_MODEL, EXTRACTION_MAX_TOKENS, EXTRACTION_PROMPT, parseExtractionOutput } from "../../src/lib/anthropic";
import type { UploadedFile } from "../../src/lib/types";

const BUCKET = "documenti-condominiali";

function mediaTypeForImage(type: string): "image/jpeg" | "image/png" | "image/webp" {
  return type as "image/jpeg" | "image/png" | "image/webp";
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
export default async (req: Request, context: Context) => {
  const { jobId, files } = (await req.json()) as { jobId: string; files: UploadedFile[] };
  console.log(`extract-background invoked: jobId=${jobId}, files=${files.length}`);
  console.log(`env check: url=${Boolean(Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"))} key=${Boolean(Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"))} anthropic=${Boolean(Netlify.env.get("ANTHROPIC_API_KEY"))}`);
  const store = getStore("extractions");

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
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const content: Anthropic.MessageParam["content"] = [];

    for (const file of files) {
      const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
      if (error || !data) {
        throw new Error(`Download fallito per ${file.name}: ${error?.message ?? "sconosciuto"}`);
      }
      const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");

      if (file.type === "application/pdf") {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
      } else if (file.type.startsWith("image/")) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: mediaTypeForImage(file.type), data: base64 },
        });
      }
    }

    content.push({ type: "text", text: EXTRACTION_PROMPT });

    const message = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: EXTRACTION_MAX_TOKENS,
      temperature: 0,
      messages: [{ role: "user", content }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const extracted = parseExtractionOutput(text);
    await store.setJSON(jobId, { status: "done", data: extracted });

    // Pulizia: i file temporanei non servono più una volta estratti.
    await supabase.storage.from(BUCKET).remove(files.map((f) => f.path));
  } catch (error) {
    console.error("Background extraction error:", error);
    const message = error instanceof Error ? error.message : String(error);
    await store.setJSON(jobId, { status: "error", error: message });
  }
};
