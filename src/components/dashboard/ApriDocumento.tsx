"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apriDocumento } from "@/lib/documenti-client";

// Apre un documento dell'archivio: il bucket è privato, il link lo firma il
// server e vale pochi minuti.
export function ApriDocumento({ percorso }: { percorso: string }) {
  const [lavorando, setLavorando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function apri() {
    setLavorando(true);
    setErrore(null);
    try {
      await apriDocumento(percorso, 0);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Documento non disponibile");
    } finally {
      setLavorando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={apri} disabled={lavorando}>
        {lavorando ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
        Apri
      </Button>
      {errore && <span className="text-xs text-destructive">{errore}</span>}
    </span>
  );
}
