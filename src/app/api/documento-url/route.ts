import { NextRequest, NextResponse } from "next/server";

import { condominiDi } from "@/lib/appartenenza";
import { BUCKET, puoLeggere } from "@/lib/percorsi";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const DURATA_LINK_S = 300;

// Un documento del condominio lo apre chi ne è membro, amministratore o
// condomino: è lo stesso rendiconto che l'amministratore di condominio deve
// comunque mettere a disposizione. Un file appena caricato, e non ancora
// salvato nei dati di nessun condominio, solo chi l'ha caricato.
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

  const supabase = createServiceRoleClient();
  const { membro } = await condominiDi(supabase, user.id);

  if (!puoLeggere(path, user.id, membro)) {
    return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
  }

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
