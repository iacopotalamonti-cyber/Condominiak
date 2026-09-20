"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

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
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [lavorando, setLavorando] = useState(false);
  const [errore, setErrore] = useState("");

  async function elimina() {
    setLavorando(true);
    setErrore("");
    try {
      const res = await fetch(
        `/api/save-bilancio?condominiumId=${encodeURIComponent(condominiumId)}&anno=${anno}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Eliminazione fallita");

      setAperto(false);
      router.refresh();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Eliminazione fallita");
    } finally {
      setLavorando(false);
    }
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
