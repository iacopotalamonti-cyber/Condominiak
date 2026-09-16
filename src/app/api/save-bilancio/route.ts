import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { CATEGORIE_SPESA_LABEL } from "@/lib/condotwin-calculations";
import { CAMPI_IMPORTO } from "@/lib/anthropic";
import { righeMovimenti } from "@/lib/movimenti";
import type { ExtractedMovimento, FonteSalvata } from "@/lib/types";

interface SaveBilancioBody {
  condominiumId: string;
  anno: number;
  prev: number;
  cons: number;
  fondo: number;
  totale: number;
  spese: Record<string, number>;
  // Provenienza per campo: "prev", "cons", "fondo", "totale",
  // "spesa.riscaldamento", ...
  fonti: Record<string, unknown>;
  movimenti: ExtractedMovimento[];
  documentoPath: string | null;
}

const ANNO_MIN = 1900;
const MAX_TESTO_FONTE = 300;

function importo(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

// La provenienza arriva dal client e finisce su Postgres: si tiene solo ciò
// che ha la forma attesa, e il testo si tronca perché è una riga di tabella,
// non un documento.
function fonte(value: unknown): FonteSalvata | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;

  const documento = typeof r.documento === "string" ? r.documento.slice(0, 200) : "";
  const pagina = Number.isFinite(Number(r.pagina)) ? Math.max(0, Math.round(Number(r.pagina))) : 0;
  const testo = typeof r.testo === "string" ? r.testo.slice(0, MAX_TESTO_FONTE) : "";

  if (!documento && !pagina && !testo) return null;
  return {
    documento,
    pagina,
    testo,
    verificata: r.verificata === true,
    verificabile: r.verificabile === true,
  };
}

function fontiValide(raw: unknown): Record<string, FonteSalvata> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, FonteSalvata> = {};

  for (const campo of CAMPI_IMPORTO) {
    const valore = fonte(source[campo]);
    if (valore) out[campo] = valore;
  }

  return out;
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
    const totale = importo(body.totale);
    const fonti = fontiValide(body.fonti);
    const documentoPath =
      typeof body.documentoPath === "string" ? body.documentoPath.slice(0, 500) : null;

    const righeSpese = Object.entries(body.spese ?? {})
      .filter(([categoria]) => categoria in CATEGORIE_SPESA_LABEL)
      .map(([categoria, valore]) => {
        const origine = fonti[`spesa.${categoria}`];
        return {
          condominium_id: condominiumId,
          anno,
          categoria,
          importo: importo(valore),
          fonte_documento: origine?.documento || null,
          fonte_pagina: origine?.pagina || null,
          fonte_testo: origine?.testo || null,
          fonte_verificata: origine?.verificata ?? false,
          fonte_verificabile: origine?.verificabile ?? false,
          documento_path: documentoPath,
        };
      })
      .filter((riga) => riga.importo > 0);

    const movimenti = righeMovimenti(
      condominiumId,
      anno,
      body.movimenti,
      CATEGORIE_SPESA_LABEL,
      () => documentoPath
    );

    if (!prev && !cons && !fondo && !righeSpese.length && !movimenti.length) {
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
      const fontiTotali = Object.fromEntries(
        Object.entries(fonti).filter(([campo]) => !campo.startsWith("spesa."))
      );

      const { error } = await supabase.from("bilanci").insert({
        condominium_id: condominiumId,
        anno,
        preventivo: prev || null,
        consuntivo: cons || null,
        fondo_riserva: fondo || null,
        totale_documento: totale || null,
        fonti: Object.keys(fontiTotali).length ? fontiTotali : null,
        documento_path: documentoPath,
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

    // Come per le spese, ricaricare lo stesso anno sostituisce il dettaglio
    // invece di affiancarne una seconda copia.
    const { error: delMovErr } = await supabase
      .from("movimenti")
      .delete()
      .eq("condominium_id", condominiumId)
      .eq("anno", anno);
    if (delMovErr) throw delMovErr;

    if (movimenti.length) {
      const { error } = await supabase.from("movimenti").insert(movimenti);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, anno });
  } catch (error) {
    console.error("Save bilancio error:", error);
    return NextResponse.json({ success: false, error: "Salvataggio fallito" }, { status: 500 });
  }
}
