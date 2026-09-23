"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import {
  TIPI_ACCETTATI,
  analizzaDocumenti,
  caricaSuStorage,
  messaggioErrore,
} from "@/lib/extraction-client";
import {
  CAMPI_IMPORTO,
  bilancioVuoto,
  controlliBilancio,
  etichettaCampo,
  leggiImporto,
  scriviImporto,
  sommaSpese,
} from "@/lib/anthropic";
import { etichettaDocumento, percorsoDocumento } from "@/lib/documenti-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoImporto } from "@/components/estrazione/CampoImporto";
import { ControlliBilancio } from "@/components/estrazione/ControlliBilancio";
import { formatEuro, formatUso } from "@/lib/calcoli";
import type {
  CampoImporto as CampoImportoKey,
  DocumentoArchiviato,
  ExtractedBilancio,
  UploadedFile,
} from "@/lib/types";

interface AggiungiBilancioProps {
  condominiumId: string;
  anniEsistenti: number[];
  archiviati: DocumentoArchiviato[];
}

const CAMPI_TOTALI: CampoImportoKey[] = ["prev", "cons", "fondo", "totale"];
const CAMPI_SPESA = CAMPI_IMPORTO.filter((c) => c.startsWith("spesa."));

export function AggiungiBilancio({
  condominiumId,
  anniEsistenti,
  archiviati,
}: AggiungiBilancioProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [bilancio, setBilancio] = useState<ExtractedBilancio | null>(null);
  const [annoTesto, setAnnoTesto] = useState("");
  const [documenti, setDocumenti] = useState<UploadedFile[]>([]);
  const [note, setNote] = useState("");
  const [uso, setUso] = useState("");
  const [lavorando, setLavorando] = useState(false);
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);
  const [confermato, setConfermato] = useState(false);

  function reset() {
    setFile(null);
    setBilancio(null);
    setAnnoTesto("");
    setDocumenti([]);
    setNote("");
    setUso("");
    setConfermato(false);
    setStato("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function aggiorna(campo: CampoImportoKey, valore: number) {
    setBilancio((precedente) => {
      if (!precedente) return precedente;
      const copia: ExtractedBilancio = {
        ...precedente,
        spese: { ...precedente.spese },
        fonti: { ...precedente.fonti },
        conflitti: { ...precedente.conflitti },
      };
      scriviImporto(copia, campo, valore);
      // Correggere a mano un importo risolve il conflitto: la scelta è stata
      // fatta, non ha più senso riproporla.
      delete copia.conflitti[campo];
      return copia;
    });
  }

  async function analizza(archiviato?: DocumentoArchiviato) {
    if (!archiviato && !file) return;
    setLavorando(true);
    setErrore(null);
    setEsito(null);

    try {
      // Un documento già in archivio non va ricaricato: alla funzione di
      // estrazione serve solo il suo percorso, che abbiamo già.
      let caricati: UploadedFile[];
      if (archiviato) {
        setStato(`Rilettura di ${archiviato.nome}…`);
        caricati = [{ name: archiviato.nome, type: "application/pdf", path: archiviato.path }];
      } else {
        setStato("Caricamento del documento…");
        caricati = await caricaSuStorage([file as File]);
        setStato("Analisi AI in corso…");
      }

      const risultato = await analizzaDocumenti(caricati, "bilancio", setStato);
      const estratto = risultato.bilanci[0] ?? bilancioVuoto();

      setBilancio(estratto);
      setAnnoTesto(estratto.anno ? String(estratto.anno) : "");
      setDocumenti(risultato.documenti);
      setNote(risultato.note);
      setUso(formatUso(risultato.uso));
    } catch (err) {
      setErrore(messaggioErrore(err));
    } finally {
      setLavorando(false);
      setStato("");
    }
  }

  const annoNumero = Number(annoTesto);
  const annoValido = Number.isInteger(annoNumero) && annoNumero > 1900;
  const annoGiaPresente = annoValido && anniEsistenti.includes(annoNumero);

  // I controlli girano sui valori attuali, non su quelli estratti: correggere
  // un importo deve far sparire l'avviso subito, senza rianalizzare nulla.
  const controlli = useMemo(
    () => (bilancio ? controlliBilancio({ ...bilancio, anno: annoValido ? annoNumero : 0 }) : []),
    [bilancio, annoValido, annoNumero]
  );

  const totaleSpese = bilancio ? sommaSpese(bilancio.spese) : 0;

  // Un anno mancante o assurdo impedisce di salvare: senza, la riga finirebbe
  // nello storico sotto l'esercizio sbagliato. I conti che non tornano invece
  // non bloccano — il documento può averli così — ma chiedono di dichiarare di
  // aver guardato il PDF, che è esattamente il controllo che serve.
  const bloccanti = controlli.filter((c) => c.livello === "errore" && c.campo === "");
  const daConfermare = controlli.some((c) => c.livello === "errore" && c.campo !== "");

  async function salva() {
    if (!bilancio) return;
    setLavorando(true);
    setErrore(null);

    try {
      const res = await fetch("/api/save-bilancio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominiumId,
          anno: annoNumero,
          prev: bilancio.prev,
          cons: bilancio.cons,
          fondo: bilancio.fondo,
          totale: bilancio.totale,
          spese: bilancio.spese,
          fonti: bilancio.fonti,
          movimenti: bilancio.movimenti,
          incassi: bilancio.incassi,
          quote: bilancio.quote,
          documentoPath: documenti[0]?.path ?? null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Salvataggio fallito");

      reset();
      setEsito(`Bilancio ${annoNumero} aggiunto allo storico.`);
      router.push(`/dashboard/spese?anno=${annoNumero}`);
      router.refresh();
    } catch (err) {
      setErrore(messaggioErrore(err));
    } finally {
      setLavorando(false);
    }
  }

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

        {!bilancio ? (
          <>
            <p className="text-sm text-muted-foreground">
              Carica il bilancio di un singolo esercizio — preventivo o consuntivo, un anno alla
              volta. L&apos;AI ne ricava l&apos;anno e le voci di spesa e te le mostra con la pagina
              del documento da cui vengono, così puoi verificarle e correggerle prima di salvare.
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
              <Button onClick={() => analizza()} disabled={!file || lavorando}>
                {lavorando ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Analizza con AI
              </Button>
            </div>
            {lavorando && stato && <p className="text-sm text-muted-foreground">{stato}</p>}

            {archiviati.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-sm font-medium">Documenti già in archivio</p>
                <p className="text-sm text-muted-foreground">
                  Questi li abbiamo già: rileggerli non richiede di ricaricarli. Serve quando
                  l&apos;estrazione è migliorata e vuoi rifare i conti sullo stesso documento.
                </p>
                <div className="flex flex-wrap gap-2">
                  {archiviati.map((doc) => (
                    <Button
                      key={doc.path}
                      variant="outline"
                      size="sm"
                      disabled={lavorando}
                      onClick={() => analizza(doc)}
                      title={doc.nome}
                    >
                      <RefreshCw />
                      <span className="max-w-64 truncate">{etichettaDocumento(doc)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 sm:max-w-40">
              <Label htmlFor="bilancio-anno">Anno dell&apos;esercizio</Label>
              <Input
                id="bilancio-anno"
                type="number"
                value={annoTesto}
                onChange={(e) => setAnnoTesto(e.target.value)}
              />
            </div>

            {annoGiaPresente && (
              <p className="text-sm text-warning">
                L&apos;anno {annoNumero} è già presente nello storico: i dati esistenti verranno
                sostituiti da questi.
              </p>
            )}

            <ControlliBilancio
              controlli={controlli}
              messaggioOk="I conti tornano: le voci di spesa sommano al totale del documento."
            />

            <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              {CAMPI_TOTALI.map((campo) => (
                <CampoImporto
                  key={campo}
                  id={`bilancio-${campo}`}
                  etichetta={etichettaCampo(campo)}
                  valore={leggiImporto(bilancio, campo)}
                  fonte={bilancio.fonti[campo]}
                  conflitti={bilancio.conflitti[campo]}
                  percorso={percorsoDocumento(documenti, bilancio.fonti[campo])}
                  onChange={(v) => aggiorna(campo, v)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Voci di spesa</span>
                <span className="text-muted-foreground">
                  Somma delle voci: {formatEuro(totaleSpese)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPI_SPESA.map((campo) => (
                  <CampoImporto
                    key={campo}
                    id={`bilancio-${campo}`}
                    etichetta={etichettaCampo(campo)}
                    valore={leggiImporto(bilancio, campo)}
                    fonte={bilancio.fonti[campo]}
                    conflitti={bilancio.conflitti[campo]}
                    percorso={percorsoDocumento(documenti, bilancio.fonti[campo])}
                    onChange={(v) => aggiorna(campo, v)}
                  />
                ))}
              </div>
            </div>

            {bilancio.movimenti.length > 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                Estratte {bilancio.movimenti.length} righe di dettaglio, di cui{" "}
                {bilancio.movimenti.filter((m) => m.fornitore).length} con un fornitore
                riconosciuto. I totali qui sopra sono la loro somma; li trovi in Fornitori dopo il
                salvataggio.
              </p>
            )}

            {note && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{note}</p>
            )}

            {uso && <p className="text-xs text-muted-foreground">{uso}</p>}

            {daConfermare && (
              <label className="flex items-start gap-2 rounded-md border border-warning/40 px-3 py-2 text-sm">
                <Checkbox
                  checked={confermato}
                  onCheckedChange={(valore) => setConfermato(valore === true)}
                  className="mt-0.5"
                />
                <span>
                  Ho aperto il documento e verificato questi importi: salvali comunque.
                </span>
              </label>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="ghost" onClick={reset} disabled={lavorando}>
                Annulla
              </Button>
              <Button
                onClick={salva}
                disabled={
                  !annoValido || bloccanti.length > 0 || (daConfermare && !confermato) || lavorando
                }
              >
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
