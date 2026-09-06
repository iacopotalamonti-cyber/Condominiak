import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
    }

    const { unitaId, email } = (await req.json()) as { unitaId: string; email: string };

    if (!unitaId || !email) {
      return NextResponse.json(
        { success: false, error: "unitaId ed email sono obbligatori" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Verifica che l'unità appartenga a un condominio dell'amministratore corrente
    const { data: unita, error: unitaErr } = await supabase
      .from("unita")
      .select("id, condominium_id, condominiums!inner(owner_id)")
      .eq("id", unitaId)
      .single();

    if (unitaErr || !unita || (unita as any).condominiums.owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Unità non trovata o non autorizzata" },
        { status: 403 }
      );
    }

    await supabase.from("unita").update({ email }).eq("id", unitaId);

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${unitaId}`;

    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { unita_id: unitaId },
    });

    if (inviteErr) throw inviteErr;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite resident error:", error);
    return NextResponse.json({ success: false, error: "Invito fallito" }, { status: 500 });
  }
}
