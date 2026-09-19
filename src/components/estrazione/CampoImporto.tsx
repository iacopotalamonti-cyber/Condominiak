"use client";

import { useState } from "react";
import { BadgeCheck, CircleHelp, FileText, TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro } from "@/lib/calcoli";
import { apriDocumento } from "@/lib/documenti-client";
import { cn } from "@/lib/utils";
import type { Fonte, ValoreScartato } from "@/lib/types";

interface CampoImportoProps {
  id: string;
  etichetta: string;
  valore: number;
  fonte?: Fonte;
  conflitti?: ValoreScartato[];
  // Percorso su storage del documento da cui viene la fonte, se conservato.
  percorso?: string | null;
  onChange: (valore: number) => void;
}

// Un importo estratto non è un numero e basta: è un numero più il punto del
// documento da cui è stato letto. Mostrare i due insieme è ciò che permette di
// accorgersi di un errore invece di scoprirlo mesi dopo.
export function CampoImporto({
  id,
  etichetta,
  valore,
  fonte,
  conflitti,
  percorso,
  onChange,
}: CampoImportoProps) {
  const [erroreLink, setErroreLink] = useState<string | null>(null);

  async function apri() {
    if (!percorso || !fonte) return;
    setErroreLink(null);
    try {
      await apriDocumento(percorso, fonte.pagina);
    } catch (err) {
      setErroreLink(err instanceof Error ? err.message : "Documento non disponibile");
    }
  }

  const haFonte = Boolean(fonte?.pagina);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{etichetta}</Label>
        {fonte?.verificata ? (
          <span
            className="flex items-center gap-1 text-xs text-success"
            title="Le cifre sono state ritrovate nel testo di quella pagina del PDF"
          >
            <BadgeCheck className="size-3.5" />
            verificato
          </span>
        ) : fonte?.verificabile ? (
          <span
            className="flex items-center gap-1 text-xs text-destructive"
            title="La pagina del PDF è leggibile ma non contiene questo importo: controllalo"
          >
            <TriangleAlert className="size-3.5" />
            non trovato nella pagina
          </span>
        ) : fonte?.pagina ? (
          <span
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title="Il documento non ha testo selezionabile (scansione): la verifica automatica non è possibile"
          >
            <CircleHelp className="size-3.5" />
            non verificabile
          </span>
        ) : null}
      </div>

      <Input
        id={id}
        type="number"
        step="0.01"
        value={valore || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />

      {valore > 0 &&
        (haFonte ? (
          <button
            type="button"
            onClick={apri}
            disabled={!percorso}
            className={cn(
              "flex items-start gap-1.5 text-left text-xs text-muted-foreground",
              percorso && "hover:text-foreground hover:underline"
            )}
            title={percorso ? "Apri il documento a questa pagina" : undefined}
          >
            <FileText className="mt-0.5 size-3 shrink-0" />
            <span>
              pag. {fonte?.pagina}
              {fonte?.testo && <> · «{fonte.testo}»</>}
            </span>
          </button>
        ) : (
          <span className="flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            origine non indicata: controlla il documento
          </span>
        ))}

      {erroreLink && <span className="text-xs text-destructive">{erroreLink}</span>}

      {conflitti?.map((scartato, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-warning">
          <TriangleAlert className="size-3 shrink-0" />
          <span>
            altra lettura: {formatEuro(scartato.valore)}
            {scartato.fonte?.pagina ? ` (${scartato.fonte.documento}, pag. ${scartato.fonte.pagina})` : ""}
          </span>
          <button
            type="button"
            onClick={() => onChange(scartato.valore)}
            className="underline hover:text-foreground"
          >
            usa questo
          </button>
        </div>
      ))}
    </div>
  );
}
