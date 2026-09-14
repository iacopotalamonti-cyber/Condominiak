import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { CATEGORIE_SPESA_LABEL } from "@/lib/condotwin-calculations";

interface SaveBilancioBody {
  condominiumId: string;
  anno: number;
  prev: number;
  cons: number;
  fondo: number;
  spese: Record<string, number>;
}

const ANNO_MIN = 1900;

function importo(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
    }

    const body = (await req.json()) as SaveBilancioBody;
    const anno = Number(body.anno);

    if (!Number.isInteger(anno) || anno < ANNO_MIN || anno > new Date().getFullYear() + 1) {
      return NextResponse.json({ success: false, error: "Anno non valido" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Il condominiumId arriva dal client: va verificato che sia davvero di chi
    // sta scrivendo, perché da qui in poi si usa la service role key.
    const { data: condominium } = await supabase
      .from("condominiums")
      .select("id")
      .eq("id", body.condominiumId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!condominium) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    const condominiumId = condominium.id as string;
    const prev = importo(body.prev);
    const cons = importo(body.cons);
    const fondo = importo(body.fondo);

    const righeSpese = Object.entries(body.spese ?? {})
      .filter(([categoria]) => categoria in CATEGORIE_SPESA_LABEL)
      .map(([categoria, valore]) => ({
        condominium_id: condominiumId,
        anno,
        categoria,
        importo: importo(valore),
      }))
      .filter((riga) => riga.importo > 0);

    if (!prev && !cons && !fondo && !righeSpese.length) {
      return NextResponse.json(
        { success: false, error: "Nessun dato da salvare per questo anno" },
        { status: 400 }
      );
    }

    // Ricaricare lo stesso anno lo sostituisce invece di duplicarlo.
    const { error: delBilancioErr } = await supabase
      .from("bilanci")
      .delete()
      .eq("condominium_id", condominiumId)
      .eq("anno", anno);
    if (delBilancioErr) throw delBilancioErr;

    if (prev || cons || fondo) {
      const { error } = await supabase.from("bilanci").insert({
        condominium_id: condominiumId,
        anno,
        preventivo: prev || null,
        consuntivo: cons || null,
        fondo_riserva: fondo || null,
      });
      if (error) throw error;
    }

    const { error: delSpeseErr } = await supabase
      .from("spese")
      .delete()
      .eq("condominium_id", condominiumId)
      .eq("anno", anno);
    if (delSpeseErr) throw delSpeseErr;

    if (righeSpese.length) {
      const { error } = await supabase.from("spese").insert(righeSpese);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, anno });
  } catch (error) {
    console.error("Save bilancio error:", error);
    return NextResponse.json({ success: false, error: "Salvataggio fallito" }, { status: 500 });
  }
}
