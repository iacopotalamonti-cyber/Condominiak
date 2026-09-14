import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, EXTRACTION_MODEL, EXTRACTION_MAX_TOKENS, EXTRACTION_PROMPT } from "@/lib/anthropic";
import type { UploadedFile } from "@/lib/types";

export const maxDuration = 120;

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

    let clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    let extracted;
    try {
      extracted = JSON.parse(clean);
    } catch {
      console.error("JSON parse failed. Raw model output:", text);
      return NextResponse.json(
        { success: false, error: "La risposta AI non era in formato JSON valido", raw: text.slice(0, 2000) },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: extracted });
  } catch (error) {
    console.error("Extraction error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
