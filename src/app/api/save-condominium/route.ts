import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ExtractedBilancio,
  ExtractedImpiantiDettagli,
  ExtractedInfo,
  ExtractedUnita,
  Fonte,
  UploadedFile,
} from "@/lib/types";
import { CATEGORIE_SPESA_LABEL } from "@/lib/calcoli";
import { righeMovimenti } from "@/lib/movimenti";
import { chiaveFornitore } from "@/lib/fornitori";
import { risolviFornitori } from "@/lib/fornitori-server";
import { COOKIE_CONDOMINIO } from "@/lib/appartenenza";

interface SaveCondominiumBody {
  info: ExtractedInfo;
  unita: ExtractedUnita[];
  bilanci: ExtractedBilancio[];
  imp: Record<string, boolean>;
  impDet: ExtractedImpiantiDettagli;
  documenti: UploadedFile[];
}

const MAX_TESTO_FONTE = 300;

// La provenienza arriva dal client: si conserva solo ciò che ha la forma
// attesa, con il testo troncato perché è una riga di tabella.
function fonteValida(value: Fonte | undefined): Fonte | null {
  if (!value || typeof value !== "object") return null;
  const documento = typeof value.documento === "string" ? value.documento.slice(0, 200) : "";
  const pagina = Number.isFinite(Number(value.pagina)) ? Math.max(0, Math.round(Number(value.pagina))) : 0;
  const testo = typeof value.testo === "string" ? value.testo.slice(0, MAX_TESTO_FONTE) : "";
  if (!documento && !pagina && !testo) return null;
  return {
    documento,
    pagina,
    testo,
    verificata: value.verificata === true,
    verificabile: value.verificabile === true,
  };
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
    const { info, unita, bilanci, imp, impDet, documenti } = body;

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

    // Chi registra il condominio ne diventa admin. owner_id lo ricorda, ma è
    // membri a decidere chi vede e chi scrive: senza questa riga, chi ha
    // appena creato il condominio non potrebbe aprirlo.
    const { error: membroErr } = await supabase
      .from("membri")
      .insert({ condominium_id: condominiumId, user_id: user.id, ruolo: "admin" });
    if (membroErr) throw membroErr;

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

    // 3. bilanci (bulk, solo anni con dati) con la provenienza dei totali
    const percorsoDi = (nome: string) =>
      documenti?.find((d) => d.name === nome)?.path ?? null;

    const esercizi = (bilanci ?? []).filter((b) => b.anno > 0);

    if (esercizi.length) {
      const rows = esercizi
        .filter((b) => b.prev || b.cons || b.fondo)
        .map((b) => {
          const fonti: Record<string, Fonte> = {};
          for (const campo of ["prev", "cons", "fondo", "totale"] as const) {
            const fonte = fonteValida(b.fonti?.[campo]);
            if (fonte) fonti[campo] = fonte;
          }
          const origine = fonti.cons ?? fonti.prev ?? fonti.totale;

          return {
            condominium_id: condominiumId,
            anno: b.anno,
            preventivo: b.prev || null,
            consuntivo: b.cons || null,
            fondo_riserva: b.fondo || null,
            totale_documento: b.totale || null,
            fonti: Object.keys(fonti).length ? fonti : null,
            documento_path: origine ? percorsoDi(origine.documento) : null,
          };
        });
      if (rows.length) {
        const { error } = await supabase.from("bilanci").insert(rows);
        if (error) throw error;
      }
    }

    // 4. spese: ogni voce resta attaccata all'anno del proprio esercizio,
    //    invece di finire tutta sotto l'anno più recente come prima.
    const righeSpese = esercizi.flatMap((b) =>
      Object.entries(b.spese ?? {})
        .filter(([categoria, importo]) => categoria in CATEGORIE_SPESA_LABEL && importo > 0)
        .map(([categoria, importo]) => {
          const fonte = fonteValida(b.fonti?.[`spesa.${categoria}` as keyof typeof b.fonti]);
          return {
            condominium_id: condominiumId,
            anno: b.anno,
            categoria,
            importo,
            fonte_documento: fonte?.documento || null,
            fonte_pagina: fonte?.pagina || null,
            fonte_testo: fonte?.testo || null,
            fonte_verificata: fonte?.verificata ?? false,
            fonte_verificabile: fonte?.verificabile ?? false,
            documento_path: fonte ? percorsoDi(fonte.documento) : null,
          };
        })
    );

    if (righeSpese.length) {
      const { error } = await supabase.from("spese").insert(righeSpese);
      if (error) throw error;
    }

    // 4b. movimenti: il dettaglio riga per riga di ciascun esercizio
    const fornitori = await risolviFornitori(
      supabase,
      condominiumId,
      esercizi.flatMap((b) => (b.movimenti ?? []).map((m) => m?.fornitore))
    );

    const righeMov = esercizi.flatMap((b) =>
      righeMovimenti(
        condominiumId,
        b.anno,
        b.movimenti,
        CATEGORIE_SPESA_LABEL,
        percorsoDi,
        (nome) => fornitori.get(chiaveFornitore(nome)) ?? null
      )
    );

    if (righeMov.length) {
      const { error } = await supabase.from("movimenti").insert(righeMov);
      if (error) throw error;
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

    // Chi ha già un condominio e ne registra un altro deve ritrovarsi in quello

    // nuovo, non nel primo.

    (await cookies()).set(COOKIE_CONDOMINIO, condominiumId, {

      httpOnly: true,

      sameSite: "lax",

      secure: process.env.NODE_ENV === "production",

      maxAge: 60 * 60 * 24 * 365,

      path: "/",

    });


    return NextResponse.json({ success: true, condominiumId });
  } catch (error) {
    console.error("Save condominium error:", error);
    return NextResponse.json(
      { success: false, error: "Salvataggio fallito" },
      { status: 500 }
    );
  }
}
