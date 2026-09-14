"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import {
  TIPI_ACCETTATI,
  analizzaDocumenti,
  caricaSuStorage,
  messaggioErrore,
} from "@/lib/extraction-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIE_SPESA_LABEL, formatEuro } from "@/lib/condotwin-calculations";
import type { ExtractedSpese } from "@/lib/types";

interface Estratto {
  anno: string;
  prev: number;
  cons: number;
  fondo: number;
  spese: ExtractedSpese;
  note: string;
}

interface AggiungiBilancioProps {
  condominiumId: string;
  anniEsistenti: number[];
}

export function AggiungiBilancio({ condominiumId, anniEsistenti }: AggiungiBilancioProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [estratto, setEstratto] = useState<Estratto | null>(null);
  const [lavorando, setLavorando] = useState(false);
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setEstratto(null);
    setStato("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analizza() {
    if (!file) return;
    setLavorando(true);
    setErrore(null);
    setEsito(null);
    setStato("Caricamento del documento…");

    try {
      const caricati = await caricaSuStorage([file]);
      setStato("Analisi AI in corso…");

      const risultato = await analizzaDocumenti(caricati, "bilancio", setStato);
      const bilancio = risultato.bilanci[0];

      setEstratto({
        anno: bilancio?.anno ? String(bilancio.anno) : "",
        prev: bilancio?.prev ?? 0,
        cons: bilancio?.cons ?? 0,
        fondo: bilancio?.fondo ?? 0,
        spese: risultato.spese,
        note: risultato.note,
      });
    } catch (err) {
      setErrore(messaggioErrore(err));
    } finally {
      setLavorando(false);
      setStato("");
    }
  }

  async function salva() {
    if (!estratto) return;
    setLavorando(true);
    setErrore(null);

    try {
      const res = await fetch("/api/save-bilancio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominiumId,
          anno: Number(estratto.anno),
          prev: estratto.prev,
          cons: estratto.cons,
          fondo: estratto.fondo,
          spese: estratto.spese,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Salvataggio fallito");

      const anno = estratto.anno;
      reset();
      setEsito(`Bilancio ${anno} aggiunto allo storico.`);
      router.push(`/dashboard/spese?anno=${anno}`);
      router.refresh();
    } catch (err) {
      setErrore(messaggioErrore(err));
    } finally {
      setLavorando(false);
    }
  }

  const voci = estratto
    ? Object.entries(estratto.spese)
        .filter(([, importo]) => importo > 0)
        .sort(([, a], [, b]) => b - a)
    : [];
  const totale = voci.reduce((somma, [, importo]) => somma + importo, 0);
  const annoNumero = Number(estratto?.anno);
  const annoValido = Number.isInteger(annoNumero) && annoNumero > 1900;
  const annoGiaPresente = annoValido && anniEsistenti.includes(annoNumero);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aggiungi un bilancio allo storico</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errore && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errore}</p>
        )}
        {esito && (
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{esito}</p>
        )}

        {!estratto ? (
          <>
            <p className="text-sm text-muted-foreground">
              Carica il bilancio di un singolo esercizio — preventivo o consuntivo, un anno alla
              volta: l&apos;AI ne ricava l&apos;anno e le voci di spesa, e te le mostra prima di
              salvarle.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="bilancio-file">Documento (PDF o immagine)</Label>
                <Input
                  id="bilancio-file"
                  ref={inputRef}
                  type="file"
                  accept={TIPI_ACCETTATI.join(",")}
                  disabled={lavorando}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button onClick={analizza} disabled={!file || lavorando}>
                {lavorando ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Analizza con AI
              </Button>
            </div>
            {lavorando && stato && <p className="text-sm text-muted-foreground">{stato}</p>}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 sm:max-w-40">
              <Label htmlFor="bilancio-anno">Anno dell&apos;esercizio</Label>
              <Input
                id="bilancio-anno"
                type="number"
                value={estratto.anno}
                onChange={(e) => setEstratto({ ...estratto, anno: e.target.value })}
              />
            </div>

            {!annoValido && (
              <p className="text-sm text-warning">
                L&apos;anno non è stato riconosciuto nel documento: indicalo tu prima di salvare.
              </p>
            )}
            {annoGiaPresente && (
              <p className="text-sm text-warning">
                L&apos;anno {annoNumero} è già presente nello storico: i dati esistenti verranno
                sostituiti da questi.
              </p>
            )}

            <div className="grid grid-cols-3 gap-4 border-t pt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Preventivo</p>
                <p className="font-medium tabular-nums">{formatEuro(estratto.prev)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Consuntivo</p>
                <p className="font-medium tabular-nums">{formatEuro(estratto.cons)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fondo riserva</p>
                <p className="font-medium tabular-nums">{formatEuro(estratto.fondo)}</p>
              </div>
            </div>

            {voci.length > 0 ? (
              <div className="flex flex-col gap-2 border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Voci di spesa rilevate</span>
                  <span className="text-muted-foreground">Totale: {formatEuro(totale)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                  {voci.map(([categoria, importo]) => (
                    <div key={categoria} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {CATEGORIE_SPESA_LABEL[categoria] ?? categoria}
                      </span>
                      <span className="font-medium tabular-nums">{formatEuro(importo)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="border-t pt-4 text-sm text-muted-foreground">
                Nessuna voce di spesa rilevata in questo documento.
              </p>
            )}

            {estratto.note && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {estratto.note}
              </p>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="ghost" onClick={reset} disabled={lavorando}>
                Annulla
              </Button>
              <Button onClick={salva} disabled={!annoValido || lavorando}>
                {lavorando && <Loader2 className="animate-spin" />}
                {annoGiaPresente ? "Sostituisci nello storico" : "Aggiungi allo storico"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
