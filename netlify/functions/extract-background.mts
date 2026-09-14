import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type Anthropic from "@anthropic-ai/sdk";

import {
  anthropic,
  EXTRACTION_MODEL,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_PROMPT,
  parseExtractionOutput,
} from "../../src/lib/anthropic";
import type { UploadedFile } from "../../src/lib/types";

// Documenti reali multi-pagina possono richiedere 40-90+ secondi con Claude,
// ben oltre il limite delle funzioni serverless sincrone (10-26s). Le
// Background Function di Netlify hanno 15 minuti a disposizione: qui gira
// la chiamata vera e propria, il risultato finisce su Netlify Blobs dove
// /api/extract-status lo va a leggere via polling.
export default async (req: Request, context: Context) => {
  const { jobId, files } = (await req.json()) as { jobId: string; files: UploadedFile[] };
  const store = getStore("extractions");

  try {
    const content: Anthropic.MessageParam["content"] = [];

    for (const file of files) {
      if (file.type === "application/pdf") {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: file.base64 },
        });
      } else if (file.type.startsWith("image/")) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: file.type as "image/jpeg" | "image/png" | "image/webp",
            data: file.base64,
          },
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
  } catch (error) {
    console.error("Background extraction error:", error);
    const message = error instanceof Error ? error.message : String(error);
    await store.setJSON(jobId, { status: "error", error: message });
  }
};
