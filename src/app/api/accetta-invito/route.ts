import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { COOKIE_CONDOMINIO } from "@/lib/appartenenza";
import { impronta, motivoDiRifiuto } from "@/lib/inviti";

// Accetta un invito per l'utente che ha fatto l'accesso.
//
// È il solo modo di entrare in un condominio, e passa dal server: la RLS non
// permette a nessuno di aggiungersi a membri da solo. Prima il collegamento lo
// faceva il browser, e la RLS lo bloccava in silenzio — nessun invito ha mai
// collegato nessuno.
export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
    }

    const { token } = (await req.json()) as { token?: string };
    if (!token) {
      return NextResponse.json({ success: false, error: "Invito mancante" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const hash = impronta(token);

    const { data: invito } = await supabase
      .from("inviti")
      .select("id, condominium_id, unita_id, email, ruolo, scade_il, usato_il")
      .eq("token_hash", hash)
      .maybeSingle();

    const motivo = motivoDiRifiuto(invito, user.email);
    if (motivo || !invito) {
      return NextResponse.json({ success: false, error: motivo }, { status: 403 });
    }

    // Si consuma l'invito prima di usarlo, e solo se nessuno l'ha consumato
    // nel frattempo: due clic ravvicinati non devono valere due volte.
    const { data: consumato } = await supabase
      .from("inviti")
      .update({ usato_il: new Date().toISOString(), usato_da: user.id })
      .eq("id", invito.id)
      .is("usato_il", null)
      .select("id");

    if (!consumato?.length) {
      return NextResponse.json({ success: false, error: "Questo invito è già stato usato." }, { status: 409 });
    }

    // Chi è già nel condominio resta com'è, salvo essere invitato a gestirlo:
    // un invito non toglie mai un ruolo.
    const { data: esistente } = await supabase
      .from("membri")
      .select("id, ruolo")
      .eq("condominium_id", invito.condominium_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!esistente) {
      const { error } = await supabase
        .from("membri")
        .insert({ condominium_id: invito.condominium_id, user_id: user.id, ruolo: invito.ruolo });
      if (error) throw error;
    } else if (esistente.ruolo !== "admin" && invito.ruolo === "admin") {
      const { error } = await supabase.from("membri").update({ ruolo: "admin" }).eq("id", esistente.id);
      if (error) throw error;
    }

    if (invito.unita_id) {
      const { error } = await supabase
        .from("unita_membri")
        .upsert({ unita_id: invito.unita_id, user_id: user.id }, { onConflict: "unita_id,user_id" });
      if (error) throw error;
    }

    (await cookies()).set(COOKIE_CONDOMINIO, invito.condominium_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return NextResponse.json({ success: true, condominiumId: invito.condominium_id });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ success: false, error: "Invito non accettato" }, { status: 500 });
  }
}
