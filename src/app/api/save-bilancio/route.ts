import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { chiaveFornitore } from "@/lib/fornitori";
import { risolviFornitori } from "@/lib/fornitori-server";
import { collegaQuote } from "@/lib/quote";
import { righeBilancio, type CorpoBilancio } from "@/lib/salvataggio";
import { eAdmin } from "@/lib/appartenenza";
import { archiviaTutti } from "@/lib/archivio";
import { BUCKET, nomeFile } from "@/lib/percorsi";
import type { Unita } from "@/lib/types";

interface SaveBilancioBody extends CorpoBilancio {
  condominiumId: string;
  documentoPath: string | null;
}

const ANNO_MIN = 1900;

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

    // Il condominiumId arriva dal client: va verificato che chi scrive
    // gestisca davvero quel condominio, perché da qui in poi si usa la service
    // role key. Non basta averlo registrato: conta essere fra i suoi admin.
    if (!(await eAdmin(supabase, user.id, body.condominiumId))) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    const condominiumId = body.condominiumId;
    const percorsoCaricato =
      typeof body.documentoPath === "string" ? body.documentoPath.slice(0, 500) : null;
    // Il documento entra nell'archivio del condominio insieme ai suoi numeri.
    // Un percorso che non è di chi salva, o di questo condominio, non si cita.
    const documentoPath = percorsoCaricato
      ? ((
          await archiviaTutti(
            supabase.storage.from(BUCKET),
            [{ name: nomeFile(percorsoCaricato), path: percorsoCaricato }],
            user.id,
            condominiumId
          )
        ).get(percorsoCaricato) ?? null)
      : null;

    const nomiFornitori = (body.movimenti ?? []).map((m) => m?.fornitore);
    const fornitori = await risolviFornitori(supabase, condominiumId, nomiFornitori);
    const righe = righeBilancio(body, condominiumId, documentoPath, (nome) =>
      fornitori.get(chiaveFornitore(nome)) ?? null
    );
    const { spese: righeSpese, incassi: righeIncassi, movimenti, quote } = righe;

    if (!righe.bilancio && !righeSpese.length && !movimenti.length) {
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

    if (righe.bilancio) {
      const { error } = await supabase.from("bilanci").insert(righe.bilancio);
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
          fonte_documento: documentoPath ? nomeFile(documentoPath) : null,
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

    // Il cruscotto si ricostruisce alla prossima visita con i numeri nuovi,
    // qualunque pagina si apra dopo il salvataggio.
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ success: true, anno });
  } catch (error) {
    console.error("Save bilancio error:", error);
    return NextResponse.json({ success: false, error: "Salvataggio fallito" }, { status: 500 });
  }
}
