import Link from "next/link";
import { CalendarCheck, Droplets, FileText, Percent, Scale } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { KPICard } from "@/components/dashboard/KPICard";
import { UnitSelector } from "@/components/dashboard/UnitSelector";
import { AnnoSelector } from "@/components/dashboard/AnnoSelector";
import { FonteLink } from "@/components/estrazione/FonteLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MESI_LABEL, formatEuro } from "@/lib/calcoli";
import { pertinenzeDi, scomponiQuota, tipologiaDi, type VoceQuota } from "@/lib/quote";
import type { Documento, Pagamento, QuotaUnita, Unita } from "@/lib/types";

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

const TIPOLOGIA_LABEL: Record<string, string> = {
  appartamento: "Appartamento",
  box: "Box",
  cantina: "Cantina",
  posto_auto: "Posto auto",
  altro: "Unità",
};

function formatMillesimi(valore: number): string {
  return valore.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// La quota di un appartamento non si calcola: si legge dal riparto che il
// rendiconto stampa, unità per unità. Prima questa pagina divideva i millesimi
// generali per la spesa dell'anno, e sbagliava da -34% a +59% — perché il
// condominio ripartisce con nove tabelle diverse, e riscaldamento e acqua si
// pagano a contatore.
export default async function AppartamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ unitaId?: string; anno?: string }>;
}) {
  const { role, condominium, unita: ownUnita } = await getDashboardContext();
  const supabase = await createClient();
  const annoCorrente = new Date().getFullYear();

  // L'amministratore sceglie fra gli appartamenti. Box, cantine e posti auto
  // compaiono come pertinenze dell'appartamento a cui sono intestati.
  let unitaList: Unita[] = [];
  if (role === "admin") {
    const { data } = await supabase
      .from("unita")
      .select("*")
      .eq("condominium_id", condominium.id)
      .eq("tipologia", "appartamento")
      .order("interno");
    unitaList = (data ?? []) as Unita[];
  }

  const params = await searchParams;
  const unitaSelezionata =
    role === "resident"
      ? ownUnita!
      : (unitaList.find((u) => u.id === params.unitaId) ?? unitaList[0]);

  if (!unitaSelezionata) {
    return <p className="text-sm text-muted-foreground">Nessuna unità disponibile.</p>;
  }

  const [{ data: quoteData }, { data: bilanciData }, { data: pagamentiData }, { data: documentiData }] =
    await Promise.all([
      supabase
        .from("quote_unita")
        .select("*")
        .eq("condominium_id", condominium.id)
        .order("anno", { ascending: false }),
      supabase.from("bilanci").select("anno").eq("condominium_id", condominium.id),
      supabase
        .from("pagamenti")
        .select("*")
        .eq("unita_id", unitaSelezionata.id)
        .eq("anno", annoCorrente)
        .order("mese"),
      supabase
        .from("documenti")
        .select("*")
        .eq("condominium_id", condominium.id)
        .order("created_at", { ascending: false }),
    ]);

  const tutteLeQuote = (quoteData ?? []) as QuotaUnita[];
  const pagamenti = (pagamentiData ?? []) as Pagamento[];
  const documenti = (documentiData ?? []) as Documento[];

  const quoteUnita = tutteLeQuote.filter((q) => q.unita_id === unitaSelezionata.id);
  const anni = quoteUnita.map((q) => q.anno);
  const quota = quoteUnita.find((q) => q.anno === Number(params.anno)) ?? quoteUnita[0] ?? null;

  // Gli esercizi in archivio per cui il riparto non c'è: vanno nominati,
  // altrimenti sembra che l'appartamento in quegli anni non abbia speso niente.
  const anniSenzaRiparto = [...new Set(((bilanciData ?? []) as { anno: number }[]).map((b) => b.anno))]
    .filter((anno) => !anni.includes(anno))
    .sort((a, b) => a - b);

  const scomposizione = quota ? scomponiQuota(quota) : null;
  const pertinenze = quota ? pertinenzeDi(quota, tutteLeQuote) : [];
  const totalePertinenze = pertinenze.reduce((t, q) => t + q.totale, 0);
  const millesimiGenerali = quota?.millesimi["Millesimi Generali"] ?? unitaSelezionata.millesimi;

  const pagamentoCorrente = pagamenti.find((p) => p.mese === new Date().getMonth() + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Il mio appartamento</h1>
          <p className="text-sm text-muted-foreground">
            Interno {unitaSelezionata.interno ?? "—"}
            {unitaSelezionata.nome_proprietario ? ` — ${unitaSelezionata.nome_proprietario}` : ""} —{" "}
            {condominium.via}, {condominium.citta}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anni.length > 1 && quota && (
            <AnnoSelector anni={anni} selezionato={quota.anno} base="/dashboard/appartamento" />
          )}
          {role === "admin" && unitaList.length > 0 && (
            <UnitSelector unita={unitaList} selectedId={unitaSelezionata.id} />
          )}
        </div>
      </div>

      {!quota || !scomposizione ? (
        <Card>
          <CardContent className="flex flex-col gap-2 py-8 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Nessuna quota letta per questo appartamento.</p>
            <p>
              La quota di un appartamento si legge dal riparto che il rendiconto stampa, unità per
              unità. Per questo appartamento non ne abbiamo ancora uno: carica un rendiconto che lo
              contenga da Analisi spese.
            </p>
            <p>
              Non mostriamo una stima fatta con i millesimi: il condominio ripartisce con più tabelle
              e riscaldamento e acqua si pagano a contatore, e la stima sbagliava fino al 59%.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label={`Quota ${quota.anno}`}
              value={formatEuro(quota.totale)}
              hint="letta dal riparto del rendiconto"
              icon={CalendarCheck}
            />
            <KPICard
              label="A consumo"
              value={formatEuro(scomposizione.totaleAConsumo)}
              hint="riscaldamento, acqua e consumi a contatore"
              icon={Droplets}
            />
            <KPICard
              label="Ripartita per millesimi"
              value={formatEuro(scomposizione.totalePerMillesimi)}
              hint={`su ${scomposizione.perMillesimi.length} tabelle millesimali`}
              icon={Scale}
            />
            <KPICard
              label="Millesimi generali"
              value={formatMillesimi(millesimiGenerali)}
              hint="su 1.000"
              icon={Percent}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Come si compone la quota {quota.anno}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Sezione
                  titolo="A consumo"
                  spiegazione="Si paga per quanto si usa: il contatore dell'appartamento, non i millesimi."
                  voci={scomposizione.aConsumo}
                  totale={scomposizione.totaleAConsumo}
                />
                <Sezione
                  titolo="Ripartita per millesimi"
                  spiegazione="Ogni spesa si divide con la sua tabella: i millesimi non sono gli stessi per tutte."
                  voci={scomposizione.perMillesimi}
                  totale={scomposizione.totalePerMillesimi}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
                <span>Letta dal riparto stampato nel rendiconto, non calcolata.</span>
                <FonteLink
                  pagina={quota.fonte_pagina}
                  testo={quota.fonte_documento}
                  verificata
                  verificabile
                  percorso={quota.documento_path}
                />
              </div>
            </CardContent>
          </Card>

          {pertinenze.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Altre unità a nome di {quota.nome_nel_documento}
                </CardTitle>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  Con l&apos;appartamento: {formatEuro(quota.totale + totalePertinenze)}
                </span>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2">
                  {pertinenze.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {TIPOLOGIA_LABEL[tipologiaDi(p.tipologia)]} {p.codice_unita}
                      </span>
                      <span className="font-medium tabular-nums">{formatEuro(p.totale)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Collegate per nome, come le intesta l&apos;amministratore nello stesso rendiconto.
                </p>
              </CardContent>
            </Card>
          )}

          {quoteUnita.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Negli anni</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2">
                  {quoteUnita.map((q) => {
                    const s = scomponiQuota(q);
                    return (
                      <li key={q.id} className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 text-sm">
                        <span className="font-medium">{q.anno}</span>
                        <span className="text-xs text-muted-foreground">
                          a consumo {formatEuro(s.totaleAConsumo)} · per millesimi{" "}
                          {formatEuro(s.totalePerMillesimi)}
                        </span>
                        <span className="font-medium tabular-nums">{formatEuro(q.totale)}</span>
                      </li>
                    );
                  })}
                </ul>
                {anniSenzaRiparto.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Per {anniSenzaRiparto.join(", ")} il rendiconto non riporta un riparto per unità in
                    un formato che sappiamo leggere: quegli anni mancano, invece di essere stimati.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Storico pagamenti {annoCorrente}</CardTitle>
          {pagamentoCorrente && (
            <Badge variant={STATO_VARIANT[pagamentoCorrente.stato]}>
              Questo mese: {STATO_LABEL[pagamentoCorrente.stato]}
            </Badge>
          )}
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

function Sezione({
  titolo,
  spiegazione,
  voci,
  totale,
}: {
  titolo: string;
  spiegazione: string;
  voci: VoceQuota[];
  totale: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{titolo}</h3>
          <span className="text-sm font-semibold tabular-nums">{formatEuro(totale)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{spiegazione}</p>
      </div>
      {voci.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna voce in questo esercizio.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {voci.map((v) => (
            <li key={v.nome} className="flex flex-col">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{v.nome}</span>
                <span className="font-medium tabular-nums">{formatEuro(v.importo)}</span>
              </div>
              {(v.millesimi !== null || v.importo < 0) && (
                <span className="text-xs text-muted-foreground">
                  {v.millesimi !== null && `${formatMillesimi(v.millesimi)} millesimi`}
                  {v.millesimi !== null && v.importo < 0 && " · "}
                  {/* Si dice solo ciò che il documento dice: la voce è a
                      credito. Nel 2023-2024 è il rimborso assicurativo
                      redistribuito, ma nel 2022-2023 ce n'è un'altra che non
                      corrisponde a nessun incasso noto, e dargli un nome
                      sarebbe inventarlo. */}
                  {v.importo < 0 && "a credito: riduce la quota"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
