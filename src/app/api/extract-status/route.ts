import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, parseExtractionOutput } from "@/lib/anthropic";

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get("batchId");
  if (!batchId) {
    return NextResponse.json({ success: false, error: "batchId mancante" }, { status: 400 });
  }

  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);

    if (batch.processing_status !== "ended") {
      return NextResponse.json({
        success: true,
        done: false,
        status: batch.processing_status,
        counts: batch.request_counts,
      });
    }

    for await (const result of await anthropic.messages.batches.results(batchId)) {
      if (result.result.type === "succeeded") {
        const text = result.result.message.content
          .filter((b) => b.type === "text")
          .map((b) => (b as Anthropic.TextBlock).text)
          .join("");

        try {
          const extracted = parseExtractionOutput(text);
          return NextResponse.json({ success: true, done: true, data: extracted });
        } catch {
          console.error("JSON parse failed. Raw model output:", text);
          return NextResponse.json(
            {
              success: false,
              done: true,
              error: "La risposta AI non era in formato JSON valido",
              raw: text.slice(0, 2000),
            },
            { status: 502 }
          );
        }
      }

      if (result.result.type === "errored") {
        return NextResponse.json(
          { success: false, done: true, error: result.result.error.error.message },
          { status: 502 }
        );
      }

      if (result.result.type === "expired") {
        return NextResponse.json(
          { success: false, done: true, error: "Elaborazione scaduta, riprova" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { success: false, done: true, error: "Nessun risultato trovato" },
      { status: 502 }
    );
  } catch (error) {
    console.error("Extract status error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
