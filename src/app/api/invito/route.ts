import { NextRequest, NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { impronta, motivoDiRifiuto } from "@/lib/inviti";

// Cosa dice un invito, a chi ha il link e non ha ancora fatto l'accesso: per
// quale indirizzo è, e per quale condominio. Il token stesso è la prova che la
// domanda viene dalla persona giusta, quindi qui non si chiede altro — e non si
// restituisce nient'altro.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ success: false, error: "Invito mancante" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: invito } = await supabase
    .from("inviti")
    .select("email, scade_il, usato_il, condominiums(via, civico, citta)")
    .eq("token_hash", impronta(token))
    .maybeSingle();

  // L'email non conta ancora: si controlla all'accettazione.
  const motivo = motivoDiRifiuto(invito, invito?.email);
  if (motivo || !invito) {
    return NextResponse.json({ success: false, error: motivo }, { status: 404 });
  }

  const c = Array.isArray(invito.condominiums) ? invito.condominiums[0] : invito.condominiums;
  return NextResponse.json({
    success: true,
    email: invito.email,
    condominio: c ? `${c.via}${c.civico ? ` ${c.civico}` : ""}, ${c.citta}` : "",
  });
}
