import { getStore } from "@netlify/blobs";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface ExtractionRecord {
  status: "running" | "done" | "error";
  data?: unknown;
  error?: string;
  progress?: { fatti: number; totale: number; documento: string };
  // Chi ha avviato il lavoro. Manca solo quando la funzione non ha potuto
  // sapere chi fosse, cioè quando non è riuscita nemmeno a partire.
  owner?: string | null;
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ success: false, error: "jobId mancante" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
  }

  try {
    const store = getStore("extractions");
    const record = (await store.get(jobId, { type: "json" })) as ExtractionRecord | null;

    // Il risultato contiene i numeri di un condominio: il lavoro di un altro è
    // come se non esistesse. Un errore senza proprietario è un errore di
    // configurazione del server, e dice solo quale variabile manca.
    const visibile =
      record && (record.owner === user.id || (!record.owner && record.status === "error"));
    if (!visibile) {
      return NextResponse.json({ success: true, done: false });
    }

    if (record.status === "error") {
      return NextResponse.json(
        { success: false, done: true, error: record.error || "Estrazione fallita" },
        { status: 502 }
      );
    }

    if (record.status === "running") {
      return NextResponse.json({ success: true, done: false, progress: record.progress });
    }

    return NextResponse.json({ success: true, done: true, data: record.data });
  } catch (error) {
    console.error("Extract status error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
