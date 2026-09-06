import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ExtractedBilancio,
  ExtractedImpiantiDettagli,
  ExtractedInfo,
  ExtractedSpese,
  ExtractedUnita,
} from "@/lib/types";

interface SaveCondominiumBody {
  info: ExtractedInfo;
  unita: ExtractedUnita[];
  bilanci: ExtractedBilancio[];
  spese: ExtractedSpese;
  imp: Record<string, boolean>;
  impDet: ExtractedImpiantiDettagli;
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

    const body = (await req.json()) as SaveCondominiumBody;
    const { info, unita, bilanci, spese, imp, impDet } = body;

    const supabase = createServiceRoleClient();

    // 1. condominiums
    const { data: condominium, error: condErr } = await supabase
      .from("condominiums")
      .insert({
        via: info.via || "N/D",
        citta: info.citta || "N/D",
        cap: info.cap || null,
        anno_costruzione: info.annoCostr ? parseInt(info.annoCostr, 10) : null,
        piani: info.piani || 4,
        n_appartamenti: info.nApt || unita.length || 12,
        piano_terra: info.pianoTerra ?? true,
        nome_amm: info.amm || null,
        email_amm: info.emailAmm || null,
        tel_amm: info.telAmm || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (condErr || !condominium) {
      throw condErr || new Error("Creazione condominio fallita");
    }

    const condominiumId = condominium.id as string;

    // 2. unita (bulk)
    let insertedUnita: { id: string; interno: number }[] = [];
    if (unita?.length) {
      const rows = unita.map((u) => ({
        condominium_id: condominiumId,
        interno: u.int,
        piano: u.piano || null,
        mq: u.mq || null,
        millesimi: u.ml || 0,
        nome_proprietario: u.nome || null,
        email: u.email || null,
        telefono: u.tel || null,
      }));
      const { data, error } = await supabase.from("unita").insert(rows).select("id, interno");
      if (error) throw error;
      insertedUnita = data ?? [];
    }

    // 3. bilanci (bulk, solo anni con dati)
    if (bilanci?.length) {
      const rows = bilanci
        .filter((b) => b.prev || b.cons || b.fondo)
        .map((b) => ({
          condominium_id: condominiumId,
          anno: b.anno,
          preventivo: b.prev || null,
          consuntivo: b.cons || null,
          fondo_riserva: b.fondo || null,
        }));
      if (rows.length) {
        const { error } = await supabase.from("bilanci").insert(rows);
        if (error) throw error;
      }
    }

    // 4. spese (bulk, solo categorie con importo > 0)
    const annoCorrente = bilanci?.[0]?.anno ?? new Date().getFullYear();
    if (spese) {
      const rows = Object.entries(spese)
        .filter(([, importo]) => importo > 0)
        .map(([categoria, importo]) => ({
          condominium_id: condominiumId,
          anno: annoCorrente,
          categoria,
          importo,
        }));
      if (rows.length) {
        const { error } = await supabase.from("spese").insert(rows);
        if (error) throw error;
      }
    }

    // 5. impianti (bulk, solo impianti.presente = true)
    if (imp) {
      const rows = Object.entries(imp)
        .filter(([, presente]) => presente)
        .map(([tipo, presente]) => {
          const det = (impDet as Record<string, Record<string, string> | undefined>)?.[tipo];
          return {
            condominium_id: condominiumId,
            tipo,
            presente,
            marca: det?.marca || det?.fornitore || null,
            anno_installazione: det?.anno || null,
            ultima_revisione: det?.ultima || null,
            contratto_ditta: det?.contratto || null,
            scadenza_contratto: det?.scad || null,
          };
        });
      if (rows.length) {
        const { error } = await supabase.from("impianti").insert(rows);
        if (error) throw error;
      }
    }

    // 6. pagamenti skeleton per anno corrente (tutti 'ok' di default)
    if (insertedUnita.length) {
      const oggi = new Date();
      const pagamentiRows = insertedUnita.flatMap((u) =>
        Array.from({ length: 12 }, (_, i) => ({
          condominium_id: condominiumId,
          unita_id: u.id,
          anno: oggi.getFullYear(),
          mese: i + 1,
          importo: null,
          stato: "ok" as const,
        }))
      );
      const { error } = await supabase.from("pagamenti").insert(pagamentiRows);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, condominiumId });
  } catch (error) {
    console.error("Save condominium error:", error);
    return NextResponse.json(
      { success: false, error: "Salvataggio fallito" },
      { status: 500 }
    );
  }
}
