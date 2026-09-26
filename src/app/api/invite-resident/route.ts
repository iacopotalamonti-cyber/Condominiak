import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { eAdmin } from "@/lib/appartenenza";
import { emailInvito, inviaEmail } from "@/lib/email";
import { GIORNI_VALIDITA, impronta, normalizzaEmail, nuovoToken, scadenza } from "@/lib/inviti";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crea un invito e lo manda per email all'invitato, da noreply@condominiak.me.
// Il link torna comunque a chi invita: se l'email non parte, o finisce nello
// spam, lo si può mandare a mano (WhatsApp, a voce).
export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
    }

    const body = (await req.json()) as {
      condominiumId?: string;
      unitaId?: string | null;
      email?: string;
      gestore?: boolean;
    };
    const email = normalizzaEmail(body.email ?? "");

    if (!body.condominiumId || !EMAIL.test(email)) {
      return NextResponse.json({ success: false, error: "Indirizzo email non valido" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Da qui in poi si scrive con la chiave di servizio: si verifica prima che
    // chi invita gestisca proprio il condominio che la richiesta nomina.
    if (!(await eAdmin(supabase, user.id, body.condominiumId))) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    // L'unità, se c'è, deve stare in quel condominio: altrimenti si potrebbe
    // invitare qualcuno nell'appartamento di un altro condominio.
    if (body.unitaId) {
      const { data: unita } = await supabase
        .from("unita")
        .select("id")
        .eq("id", body.unitaId)
        .eq("condominium_id", body.condominiumId)
        .maybeSingle();
      if (!unita) {
        return NextResponse.json({ success: false, error: "Unità non trovata" }, { status: 404 });
      }
    }

    const token = nuovoToken();
    const { error } = await supabase.from("inviti").insert({
      condominium_id: body.condominiumId,
      unita_id: body.unitaId ?? null,
      email,
      ruolo: body.gestore ? "admin" : "resident",
      token_hash: impronta(token),
      creato_da: user.id,
      scade_il: scadenza().toISOString(),
    });
    if (error) throw error;

    if (body.unitaId) {
      await supabase.from("unita").update({ email }).eq("id", body.unitaId);
    }

    // Il token si mostra adesso e mai più: il database ne conserva solo
    // l'impronta, quindi un link perso si sostituisce con un invito nuovo.
    const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const link = `${base}/invite/${token}`;

    const { data: condominio } = await supabase
      .from("condominiums")
      .select("via, citta")
      .eq("id", body.condominiumId)
      .maybeSingle();
    const esito = await inviaEmail(
      emailInvito({
        a: email,
        condominio: [condominio?.via, condominio?.citta].filter(Boolean).join(", ") || "il tuo condominio",
        link,
        chiInvita: user.email ?? "L'amministratore",
        gestore: Boolean(body.gestore),
        giorni: GIORNI_VALIDITA,
      })
    );

    return NextResponse.json({
      success: true,
      link,
      inviata: esito.inviata,
      motivo: esito.inviata ? null : esito.motivo,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ success: false, error: "Invito non creato" }, { status: 500 });
  }
}
