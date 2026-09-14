import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import type { UploadedFile } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { files } = (await req.json()) as { files: UploadedFile[] };

    if (!files?.length) {
      return NextResponse.json(
        { success: false, error: "Nessun documento caricato" },
        { status: 400 }
      );
    }

    const jobId = randomUUID();

    const bgRes = await fetch(new URL("/.netlify/functions/extract-background", req.nextUrl.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, files }),
    });

    if (!bgRes.ok) {
      throw new Error(`Avvio elaborazione fallito (status ${bgRes.status})`);
    }

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    console.error("Extraction start error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
