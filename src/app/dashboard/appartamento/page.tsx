import Link from "next/link";
import { CalendarCheck, FileText, Home, Percent, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { KPICard } from "@/components/dashboard/KPICard";
import { UnitSelector } from "@/components/dashboard/UnitSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIE_SPESA_LABEL,
  MESI_LABEL,
  formatEuro,
  millesimiIncompleti,
  quotaAnnua,
  quotaMensile,
  sommaMillesimi,
} from "@/lib/condotwin-calculations";
import { esercizioCorrente } from "@/lib/bilancio";
import type { Bilancio, Documento, Pagamento, Spesa, Unita } from "@/lib/types";

const STATO_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  ok: "success",
  ritardo: "warning",
  non_pagato: "destructive",
};
const STATO_LABEL: Record<string, string> = {
  ok: "Pagato",
  ritardo: "In ritardo",
  non_pagato: "Non pagato",
};

export default async function AppartamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ unitaId?: string }>;
}) {
  const { role, condominium, unita: ownUnita } = await getDashboardContext();
  const supabase = await createClient();
  const annoCorrente = new Date().getFullYear();

  let unitaList: Unita[] = [];
  if (role === "admin") {
    const { data } = await supabase
      .from("unita")
      .select("*")
      .eq("condominium_id", condominium.id)
      .order("interno");
    unitaList = (data ?? []) as Unita[];
  }

  const params = await searchParams;
  const selectedUnitId =
    role === "resident" ? ownUnita!.id : params.unitaId || unitaList[0]?.id;

  const unitaSelezionata =
    role === "resident" ? ownUnita! : unitaList.find((u) => u.id === selectedUnitId);

  if (!unitaSelezionata) {
    return <p className="text-sm text-muted-foreground">Nessuna unità disponibile.</p>;
  }

  const [{ data: bilanciData }, { data: pagamentiData }, { data: speseData }, { data: documentiData }] =
    await Promise.all([
      supabase.from("bilanci").select("*").eq("condominium_id", condominium.id),
      supabase
        .from("pagamenti")
        .select("*")
        .eq("unita_id", unitaSelezionata.id)
        .eq("anno", annoCorrente)
        .order("mese"),
      supabase.from("spese").select("*").eq("condominium_id", condominium.id).order("anno", { ascending: false }),
      supabase
        .from("documenti")
        .select("*")
        .eq("condominium_id", condominium.id)
        .order("created_at", { ascending: false }),
    ]);

  const pagamenti = (pagamentiData ?? []) as Pagamento[];
  const spese = (speseData ?? []) as Spesa[];
  const documenti = (documentiData ?? []) as Documento[];

  // Stesso esercizio e stesso totale delle altre pagine. Prima la quota veniva
  // dal consuntivo del bilancio più recente mentre il dettaglio per categoria
  // veniva da un altro anno: due numeri che non potevano tornare.
  const esercizio = esercizioCorrente(
    (bilanciData ?? []) as Bilancio[],
    spese,
    annoCorrente
  );
  const speseAnnoCorrente = spese.filter((s) => s.anno === esercizio?.anno);

  const consuntivoAnnuo = esercizio?.totale ?? 0;

  // La quota si calcola sul totale dei millesimi realmente registrati: se la
  // tabella non somma 1000, dividere per 1000 sottostimerebbe ogni rata senza
  // che nessuno se ne accorga.
  const totaleMillesimi = sommaMillesimi(unitaList);
  const rataMensile = quotaMensile(unitaSelezionata.millesimi, consuntivoAnnuo, totaleMillesimi);
  const totaleAnnuo = quotaAnnua(unitaSelezionata.millesimi, consuntivoAnnuo, totaleMillesimi);

  const meseCorrente = new Date().getMonth() + 1;
  const pagamentoCorrente = pagamenti.find((p) => p.mese === meseCorrente);
  const nonPagati = pagamenti.filter((p) => p.stato !== "ok").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Il mio appartamento</h1>
          <p className="text-sm text-muted-foreground">
            Interno {unitaSelezionata.interno} — {condominium.via}, {condominium.citta}
          </p>
        </div>
        {role === "admin" && unitaList.length > 0 && (
          <UnitSelector unita={unitaList} selectedId={unitaSelezionata.id} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Millesimi di proprietà"
          value={unitaSelezionata.millesimi.toFixed(2)}
          hint={
            millesimiIncompleti(totaleMillesimi)
              ? `su ${totaleMillesimi.toFixed(2)} registrati invece di 1000`
              : undefined
          }
          icon={Percent}
          tone={millesimiIncompleti(totaleMillesimi) ? "warning" : "default"}
        />
        <KPICard label="Rata mensile" value={formatEuro(rataMensile)} icon={Wallet} />
        <KPICard
          label={esercizio ? `Totale annuo ${esercizio.anno}` : "Totale annuo"}
          value={formatEuro(totaleAnnuo)}
          icon={CalendarCheck}
        />
        <KPICard
          label="Stato pagamento corrente"
          value={STATO_LABEL[pagamentoCorrente?.stato ?? "ok"]}
          hint={nonPagati > 0 ? `${nonPagati} mesi da regolarizzare` : "Tutto in regola"}
          icon={Home}
          tone={
            pagamentoCorrente?.stato === "non_pagato"
              ? "destructive"
              : pagamentoCorrente?.stato === "ritardo"
                ? "warning"
                : "success"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Breakdown quote per categoria {esercizio?.anno ?? ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {speseAnnoCorrente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna voce di spesa disponibile.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {speseAnnoCorrente.map((s) => {
                const quota = quotaAnnua(unitaSelezionata.millesimi, s.importo, totaleMillesimi);
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {CATEGORIE_SPESA_LABEL[s.categoria] ?? s.categoria}
                    </span>
                    <span className="font-medium tabular-nums">{formatEuro(quota)}</span>
                  </div>
                );
              })}
              {esercizio && esercizio.nonClassificato > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warning">Non classificato</span>
                  <span className="font-medium tabular-nums text-warning">
                    {formatEuro(
                      quotaAnnua(
                        unitaSelezionata.millesimi,
                        esercizio.nonClassificato,
                        totaleMillesimi
                      )
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storico pagamenti {annoCorrente}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {MESI_LABEL.map((mese, i) => {
              const p = pagamenti.find((pg) => pg.mese === i + 1);
              const stato = p?.stato ?? "ok";
              return (
                <div key={mese} className="flex flex-col items-center gap-1.5 rounded-md border py-3">
                  <span className="text-xs text-muted-foreground">{mese}</span>
                  <Badge variant={STATO_VARIANT[stato]}>{STATO_LABEL[stato]}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documenti del condominio</CardTitle>
        </CardHeader>
        <CardContent>
          {documenti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun documento disponibile.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {documenti.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2.5 text-sm">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="flex-1">{doc.nome}</span>
                  {doc.storage_path && (
                    <Link
                      href={`/dashboard/documenti?doc=${doc.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      Apri
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
