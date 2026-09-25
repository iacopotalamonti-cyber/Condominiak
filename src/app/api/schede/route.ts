import { NextRequest, NextResponse } from "next/server";

import { eOperatore } from "@/lib/operatori";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Approvare o rifiutare una scheda di formato proposta dal modello. Una scheda
// approvata la usa da quel momento l'estrazione di tutti i condomini: la
// decisione spetta a un operatore, non all'amministratore di un condominio.
export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
  }
  if (!eOperatore(user.email)) {
    return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: unknown; decisione?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const decisione = body?.decisione;
  if (!id || (decisione !== "approva" && decisione !== "rifiuta")) {
    return NextResponse.json({ success: false, error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  // Solo una proposta ancora aperta: una decisione presa non si ribalta da
  // qui per sbaglio, con un doppio clic o una pagina vecchia.
  const { data, error } = await supabase
    .from("schede_formato")
    .update({
      stato: decisione === "approva" ? "approvata" : "rifiutata",
      deciso_da: user.id,
      deciso_il: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("stato", "proposta")
    .select("id");

  if (error) {
    // L'indice unico sulle approvate: esiste già un formato con questo nome.
    const messaggio =
      error.code === "23505"
        ? "C'è già una scheda approvata con questo nome."
        : "Decisione non salvata";
    console.error("Decisione sulla scheda:", error.message);
    return NextResponse.json({ success: false, error: messaggio }, { status: 409 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { success: false, error: "La proposta non c'è più, o è già stata decisa" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
