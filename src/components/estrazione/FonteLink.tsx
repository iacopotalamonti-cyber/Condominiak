"use client";

import { useState } from "react";
import { BadgeCheck, FileText } from "lucide-react";

import { apriDocumento } from "@/lib/documenti-client";
import { cn } from "@/lib/utils";

interface FonteLinkProps {
  pagina: number | null;
  testo: string | null;
  verificata: boolean;
  percorso: string | null;
  className?: string;
}

// La provenienza serve soprattutto qui, in lettura: è guardando il totale in
// dashboard che viene il dubbio, ed è da qui che si deve poter arrivare alla
// riga del documento in un clic.
export function FonteLink({ pagina, testo, verificata, percorso, className }: FonteLinkProps) {
  const [errore, setErrore] = useState<string | null>(null);

  if (!pagina) return null;

  async function apri() {
    if (!percorso) return;
    setErrore(null);
    try {
      await apriDocumento(percorso, pagina ?? 0);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Documento non disponibile");
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <button
        type="button"
        onClick={apri}
        disabled={!percorso}
        title={testo ? `«${testo}»` : undefined}
        className={cn("inline-flex items-center gap-1", percorso && "hover:text-foreground hover:underline")}
      >
        <FileText className="size-3" />
        pag. {pagina}
      </button>
      {verificata && <BadgeCheck className="size-3 text-success" aria-label="importo verificato" />}
      {errore && <span className="text-destructive">{errore}</span>}
    </span>
  );
}
