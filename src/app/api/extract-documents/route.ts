import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, EXTRACTION_MODEL, EXTRACTION_MAX_TOKENS, EXTRACTION_PROMPT } from "@/lib/anthropic";
import type { UploadedFile } from "@/lib/types";

// Documenti reali multi-pagina possono richiedere 30-60+ secondi di elaborazione,
// oltre il limite delle funzioni serverless sincrone. Usiamo la Batch API di
// Anthropic (asincrona) per non dipendere dal timeout della funzione: questa
// route crea il batch e ritorna subito l'id, /api/extract-status lo interroga.
export async function POST(req: NextRequest) {
  try {
    const { files } = (await req.json()) as { files: UploadedFile[] };

    if (!files?.length) {
      return NextResponse.json(
        { success: false, error: "Nessun documento caricato" },
        { status: 400 }
      );
    }

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

    const batch = await anthropic.messages.batches.create({
      requests: [
        {
          custom_id: "extraction",
          params: {
            model: EXTRACTION_MODEL,
            max_tokens: EXTRACTION_MAX_TOKENS,
            temperature: 0,
            messages: [{ role: "user", content }],
          },
        },
      ],
    });

    return NextResponse.json({ success: true, batchId: batch.id });
  } catch (error) {
    console.error("Extraction batch creation error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
