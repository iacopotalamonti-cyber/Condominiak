import { getStore } from "@netlify/blobs";
import { NextRequest, NextResponse } from "next/server";

interface ExtractionRecord {
  status: "done" | "error";
  data?: unknown;
  error?: string;
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ success: false, error: "jobId mancante" }, { status: 400 });
  }

  try {
    const store = getStore("extractions");
    const record = (await store.get(jobId, { type: "json" })) as ExtractionRecord | null;

    if (!record) {
      return NextResponse.json({ success: true, done: false });
    }

    if (record.status === "error") {
      return NextResponse.json(
        { success: false, done: true, error: record.error || "Estrazione fallita" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, done: true, data: record.data });
  } catch (error) {
    console.error("Extract status error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
