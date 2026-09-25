"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { eliminaEsercizio } from "@/app/dashboard/azioni";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EliminaEsercizioProps {
  condominiumId: string;
  anno: number;
  // Quante righe spariranno: una cancellazione che non dice cosa porta via
  // è una cancellazione che si fa per sbaglio.
  voci: number;
  movimenti: number;
  // Il documento resta in archivio, quindi l'anno si può rileggere.
  documentoInArchivio: boolean;
}

export function EliminaEsercizio({
  condominiumId,
  anno,
  voci,
  movimenti,
  documentoInArchivio,
}: EliminaEsercizioProps) {
  const [aperto, setAperto] = useState(false);
  const [lavorando, avvia] = useTransition();
  const [errore, setErrore] = useState("");

  function elimina() {
    setErrore("");
    avvia(async () => {
      // L'azione server aggiorna la pagina da sola: quando torna, l'esercizio
      // è già sparito dalla tabella.
      const esito = await eliminaEsercizio(condominiumId, anno);
      if (!esito.success) {
        setErrore(esito.error);
        return;
      }
      setAperto(false);
    });
  }

  const pezzi = [
    voci && `${voci} ${voci === 1 ? "voce di spesa" : "voci di spesa"}`,
    movimenti && `${movimenti} ${movimenti === 1 ? "movimento" : "movimenti"}`,
  ].filter(Boolean) as string[];

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Elimina l'esercizio ${anno}`}
        >
          <Trash2 />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminare l&apos;esercizio {anno}?</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2 text-left">
              <p>
                {pezzi.length
                  ? `Spariscono il bilancio ${anno} e ${pezzi.join(" e ")}.`
                  : `Sparisce il bilancio ${anno}.`}{" "}
                Non si torna indietro.
              </p>
              {documentoInArchivio ? (
                <p>
                  Il documento resta in archivio: puoi rileggerlo quando vuoi da{" "}
                  <span className="font-medium">Aggiungi un bilancio</span>, senza ricaricarlo.
                </p>
              ) : (
                <p className="text-warning">
                  Per questo anno non c&apos;è un documento in archivio: per riaverlo dovrai
                  ricaricare il file.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {errore && <p className="text-sm text-destructive">{errore}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAperto(false)} disabled={lavorando}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={elimina} disabled={lavorando}>
            {lavorando && <Loader2 className="animate-spin" />}
            Elimina {anno}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
