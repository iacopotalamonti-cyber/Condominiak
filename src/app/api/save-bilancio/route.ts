import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { CATEGORIE_SPESA_LABEL } from "@/lib/calcoli";
import { CAMPI_IMPORTO } from "@/lib/anthropic";
import { righeMovimenti } from "@/lib/movimenti";
import { chiaveFornitore } from "@/lib/fornitori";
import { risolviFornitori } from "@/lib/fornitori-server";
import { collegaQuote, quoteValide } from "@/lib/quote";
import type { ExtractedMovimento, IncassoEstratto, FonteSalvata, Unita } from "@/lib/types";

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
  // Le partite di singoli condomini comprese nel totale del documento.
  incassi: IncassoEstratto[];
  // La quota di ogni unità, letta dal riparto.
  quote: unknown;
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

    // Gli incassi arrivano dal client come tutto il resto: si tiene solo ciò
    // che ha la forma giusta, e l'importo conserva il segno perché è quello a
    // dire se il documento somma o sottrae la partita.
    const righeIncassi = (Array.isArray(body.incassi) ? body.incassi : [])
      .map((incasso) => {
        const valore = Number(incasso?.importo);
        return {
          condominium_id: condominiumId,
          anno,
          descrizione:
            typeof incasso?.descrizione === "string" && incasso.descrizione.trim()
              ? incasso.descrizione.trim().slice(0, 300)
              : "Partita non descritta",
          importo: Number.isFinite(valore) ? Math.round(valore * 100) / 100 : 0,
          codice: typeof incasso?.codice === "string" ? incasso.codice.slice(0, 50) : null,
          fonte_documento: incasso?.fonte?.documento?.slice(0, 200) || null,
          fonte_pagina: incasso?.fonte?.pagina || null,
          fonte_testo: incasso?.fonte?.testo?.slice(0, MAX_TESTO_FONTE) || null,
          fonte_verificata: incasso?.fonte?.verificata === true,
          fonte_verificabile: incasso?.fonte?.verificabile === true,
          documento_path: documentoPath,
        };
      })
      .filter((riga) => riga.importo !== 0);

    const fornitori = await risolviFornitori(
      supabase,
      condominiumId,
      (body.movimenti ?? []).map((m) => m?.fornitore)
    );

    const movimenti = righeMovimenti(
      condominiumId,
      anno,
      body.movimenti,
      CATEGORIE_SPESA_LABEL,
      () => documentoPath,
      (nome) => fornitori.get(chiaveFornitore(nome)) ?? null
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

    // La tabella degli incassi arriva con una migrazione: finché non è
    // applicata il salvataggio non deve fallire per colpa sua, perché tutto il
    // resto dell'esercizio è già stato scritto. Si perde la riga, non l'anno.
    const { error: delIncassiErr } = await supabase
      .from("incassi")
      .delete()
      .eq("condominium_id", condominiumId)
      .eq("anno", anno);
    if (delIncassiErr) console.warn("Incassi non cancellabili:", delIncassiErr.message);

    if (righeIncassi.length) {
      const { error } = await supabase.from("incassi").insert(righeIncassi);
      if (error) console.warn("Incassi non salvabili:", error.message);
    }

    // Le quote per unità. Si collegano all'anagrafica per codice o, la prima
    // volta, per nome; quelle che non si sanno collegare restano, perché sono
    // numeri del documento, e aspettano un'unità.
    //
    // A differenza delle spese, un salvataggio senza quote non cancella quelle
    // già in archivio: un documento riletto dal modello non porta il riparto,
    // e sostituirlo con niente sarebbe perdere il numero più guardato
    // dell'applicazione. Per toglierle c'è la cancellazione dell'esercizio.
    const quote = quoteValide(body.quote);
    if (quote.length) {
      const { data: datiUnita } = await supabase
        .from("unita")
        .select("*")
        .eq("condominium_id", condominiumId);
      const { unitaPerCodice, codiciDaAssegnare } = collegaQuote(quote, (datiUnita ?? []) as Unita[]);

      for (const { unitaId, codice, sub } of codiciDaAssegnare) {
        const { error } = await supabase
          .from("unita")
          .update({ codice, sub: sub || null })
          .eq("id", unitaId)
          .is("codice", null);
        if (error) console.warn("Codice non assegnato all'unità:", error.message);
      }

      const { error: delQuoteErr } = await supabase
        .from("quote_unita")
        .delete()
        .eq("condominium_id", condominiumId)
        .eq("anno", anno);
      if (delQuoteErr) throw delQuoteErr;

      const { error } = await supabase.from("quote_unita").insert(
        quote.map((q) => ({
          condominium_id: condominiumId,
          anno,
          unita_id: unitaPerCodice.get(q.codice) ?? null,
          codice_unita: q.codice,
          tipologia: q.tipologia || null,
          nome_nel_documento: q.nome || null,
          importi: q.importi,
          millesimi: q.millesimi,
          totale: q.totale,
          fonte_documento: documentoPath?.split("/").pop() ?? null,
          fonte_pagina: q.pagina || null,
          documento_path: documentoPath,
        }))
      );
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

// Un esercizio letto male resta in archivio finché qualcuno non lo toglie, e
// falsa il grafico e i totali di ogni altra pagina. Toglierlo è una cosa che
// l'amministratore deve poter fare da solo, senza passare dal database.
export async function DELETE(req: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Non autenticato" }, { status: 401 });
    }

    const condominiumId = req.nextUrl.searchParams.get("condominiumId") ?? "";
    const anno = Number(req.nextUrl.searchParams.get("anno"));

    if (!Number.isInteger(anno) || anno < ANNO_MIN || anno > new Date().getFullYear() + 1) {
      return NextResponse.json({ success: false, error: "Anno non valido" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Stessa verifica del salvataggio: da qui in poi si usa la service role
    // key, che passa sopra a ogni permesso, quindi il condominio va dimostrato
    // di chi sta cancellando.
    const { data: condominium } = await supabase
      .from("condominiums")
      .select("id")
      .eq("id", condominiumId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!condominium) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    // Le tre tabelle che compongono un esercizio. Il documento caricato NON si
    // cancella: resta in archivio, così l'anno si può rileggere senza doverlo
    // ricaricare.
    for (const tabella of ["movimenti", "incassi", "quote_unita", "spese", "bilanci"] as const) {
      const { error } = await supabase
        .from(tabella)
        .delete()
        .eq("condominium_id", condominium.id)
        .eq("anno", anno);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, anno });
  } catch (error) {
    console.error("Delete bilancio error:", error);
    return NextResponse.json({ success: false, error: "Eliminazione fallita" }, { status: 500 });
  }
}
