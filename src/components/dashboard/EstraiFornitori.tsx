"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { analizzaDocumenti, messaggioErrore } from "@/lib/extraction-client";
import { Button } from "@/components/ui/button";
import type { DocumentoArchiviato } from "@/components/dashboard/AggiungiBilancio";

interface EstraiFornitoriProps {
  condominiumId: string;
  archiviati: DocumentoArchiviato[];
}

// I documenti sono già in archivio: per ricavarne i fornitori non serve
// ricaricarli, serve solo rileggerli. Il pulsante sta qui, sulla pagina dove
// manca il dato, invece che su un'altra pagina da andare a cercare.
export function EstraiFornitori({ condominiumId, archiviati }: EstraiFornitoriProps) {
  const router = useRouter();
  const [lavorando, setLavorando] = useState(false);
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  async function estrai() {
    setLavorando(true);
    setErrore(null);
    setEsito(null);

    let righe = 0;
    let conFornitore = 0;
    const falliti: string[] = [];

    try {
      for (const [indice, doc] of archiviati.entries()) {
        setStato(`Rilettura di ${doc.nome} (${indice + 1} di ${archiviati.length})…`);

        try {
          const risultato = await analizzaDocumenti(
            [{ name: doc.nome, type: "application/pdf", path: doc.path }],
            "bilancio",
            (messaggio) => setStato(`${doc.anno}: ${messaggio}`)
          );

          const bilancio = risultato.bilanci[0];
          if (!bilancio) {
            falliti.push(`${doc.anno} (nessun dato letto)`);
            continue;
          }

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

          righe += bilancio.movimenti.length;
          conFornitore += bilancio.movimenti.filter((m) => m.fornitore).length;
        } catch (err) {
          // Un documento illeggibile non deve fermare gli altri.
          falliti.push(`${doc.anno} (${messaggioErrore(err)})`);
        }
      }

      const riepilogo = righe
        ? `${righe} righe estratte, ${conFornitore} con un fornitore riconosciuto.`
        : "Nessuna riga di dettaglio trovata: questi documenti non elencano i singoli movimenti.";
      setEsito(falliti.length ? `${riepilogo} Non letti: ${falliti.join("; ")}.` : riepilogo);
      router.refresh();
    } catch (err) {
      setErrore(messaggioErrore(err));
    } finally {
      setLavorando(false);
      setStato("");
    }
  }

  if (!archiviati.length) return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={estrai} disabled={lavorando}>
        {lavorando ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Estrai i fornitori dai {archiviati.length} documenti in archivio
      </Button>
      {lavorando && stato && <p className="text-sm text-muted-foreground">{stato}</p>}
      {esito && <p className="text-sm text-muted-foreground">{esito}</p>}
      {errore && <p className="text-sm text-destructive">{errore}</p>}
      {!lavorando && !esito && (
        <p className="text-xs text-muted-foreground">
          Rilegge i documenti già caricati — non serve ricaricarli. Sostituisce i dati degli anni
          interessati, quindi eventuali correzioni fatte a mano su quegli anni vanno rifatte.
        </p>
      )}
    </div>
  );
}
