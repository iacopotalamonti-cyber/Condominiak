import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const BUCKET = "documenti-condominiali";
const DURATA_LINK_S = 300;

// Il percorso dei documenti è `<prefisso>/<userId>/<file>`: l'utente può
// firmare solo quelli sotto la propria cartella.
function appartieneA(path: string, userId: string): boolean {
  const segmenti = path.split("/");
  return segmenti.length >= 3 && segmenti[1] === userId;
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ success: false, error: "percorso mancante" }, { status: 400 });
  }

  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
  }

  if (!appartieneA(path, user.id)) {
    return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, DURATA_LINK_S);

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Documento non più disponibile" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, url: data.signedUrl });
}
