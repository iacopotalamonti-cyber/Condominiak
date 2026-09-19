"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { analizzaDocumenti, messaggioErrore } from "@/lib/extraction-client";
import { Button } from "@/components/ui/button";
import { formatUso } from "@/lib/calcoli";
import type { DocumentoArchiviato } from "@/components/dashboard/AggiungiBilancio";

interface EstraiFornitoriProps {
  condominiumId: string;
  archiviati: DocumentoArchiviato[];
  // Anni che hanno già dei movimenti salvati: rileggerli li sostituisce, e
  // con essi le correzioni fatte a mano.
  anniConDati?: number[];
}

// I documenti sono già in archivio: per ricavarne i fornitori non serve
// ricaricarli, serve rileggerli. Un pulsante per documento e non uno che li
// prende tutti: ogni rilettura è una chiamata al modello che si paga, e
// lanciarne tre con un clic solo è una spesa decisa dall'interfaccia invece
// che da chi la usa.
export function EstraiFornitori({
  condominiumId,
  archiviati,
  anniConDati = [],
}: EstraiFornitoriProps) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  async function rileggi(doc: DocumentoArchiviato) {
    // Una rilettura riscrive l'anno intero. Finché il salvataggio non sa
    // distinguere un importo corretto a mano da uno letto dal modello, l'unica
    // difesa onesta è chiederlo prima invece di farlo scoprire dopo.
    if (anniConDati.includes(doc.anno)) {
      const conferma = window.confirm(
        `Il ${doc.anno} ha già dei dati salvati. Rileggerlo li sostituisce, comprese le correzioni fatte a mano. Procedo?`
      );
      if (!conferma) return;
    }

    setInCorso(doc.path);
    setErrore(null);
    setEsito(null);
    setStato(`Rilettura di ${doc.nome}…`);

    try {
      const risultato = await analizzaDocumenti(
        [{ name: doc.nome, type: "application/pdf", path: doc.path }],
        "bilancio",
        setStato
      );

      const bilancio = risultato.bilanci[0];
      if (!bilancio) throw new Error("Nessun dato letto dal documento");

      const anno = bilancio.anno > 1900 ? bilancio.anno : doc.anno;
      const res = await fetch("/api/save-bilancio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominiumId,
          anno,
          prev: bilancio.prev,
          cons: bilancio.cons,
          fondo: bilancio.fondo,
          totale: bilancio.totale,
          spese: bilancio.spese,
          fonti: bilancio.fonti,
          movimenti: bilancio.movimenti,
          documentoPath: risultato.documenti[0]?.path ?? doc.path,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Salvataggio fallito");

      const conFornitore = bilancio.movimenti.filter((m) => m.fornitore).length;
      setEsito(
        bilancio.movimenti.length
          ? `${anno}: ${bilancio.movimenti.length} righe estratte, ${conFornitore} con un fornitore riconosciuto. ${formatUso(risultato.uso)}`
          : `${anno}: nessuna riga di dettaglio — questo documento non elenca i singoli movimenti. ${formatUso(risultato.uso)}`
      );
      router.refresh();
    } catch (err) {
      setErrore(`${doc.anno}: ${messaggioErrore(err)}`);
    } finally {
      setInCorso(null);
      setStato("");
    }
  }

  if (!archiviati.length) return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {archiviati.map((doc) => (
          <Button
            key={doc.path}
            variant="outline"
            size="sm"
            disabled={inCorso !== null}
            onClick={() => rileggi(doc)}
            title={doc.nome}
          >
            {inCorso === doc.path ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Rileggi {doc.anno}
          </Button>
        ))}
      </div>

      {inCorso && stato && <p className="text-sm text-muted-foreground">{stato}</p>}
      {esito && <p className="text-sm text-muted-foreground">{esito}</p>}
      {errore && <p className="text-sm text-destructive">{errore}</p>}
      {!inCorso && !esito && (
        <p className="text-xs text-muted-foreground">
          Rilegge un documento già caricato — non serve ricaricarlo. Ogni rilettura è una chiamata
          al modello che si paga, e sostituisce i dati di quell&apos;anno: eventuali correzioni
          fatte a mano vanno rifatte.
        </p>
      )}
    </div>
  );
}
