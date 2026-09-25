import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { COOKIE_CONDOMINIO, appartenenzeDi } from "@/lib/appartenenza";

const UN_ANNO_S = 60 * 60 * 24 * 365;

// Sceglie il condominio che l'utente sta guardando. Il cookie è solo una
// preferenza — chi lo legge verifica comunque l'appartenenza — ma si scrive
// soltanto per un condominio di cui l'utente fa parte.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
  }

  const { condominiumId } = (await req.json()) as { condominiumId?: string };
  const appartenenze = await appartenenzeDi(supabase, user.id);

  if (!condominiumId || !appartenenze.some((a) => a.condominium.id === condominiumId)) {
    return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
  }

  (await cookies()).set(COOKIE_CONDOMINIO, condominiumId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UN_ANNO_S,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
