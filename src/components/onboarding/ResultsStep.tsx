"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ExtractionResult } from "@/lib/types";

const SEZIONI: { key: keyof ExtractionResult["confidence"]; label: string }[] = [
  { key: "info", label: "Anagrafica edificio" },
  { key: "unita", label: "Unità immobiliari" },
  { key: "bilanci", label: "Bilanci" },
  { key: "spese", label: "Voci di spesa" },
  { key: "imp", label: "Impianti" },
];

interface ResultsStepProps {
  result: ExtractionResult;
  onContinue: () => void;
  onRetry: () => void;
}

export function ResultsStep({ result, onContinue, onRetry }: ResultsStepProps) {
  const pct = result.totale ? Math.round((result.trovati / result.totale) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-3 text-xl font-semibold">Analisi completata</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Trovati {result.trovati} campi su {result.totale} ({pct}%)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confidenza per sezione</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {SEZIONI.map((s) => {
            const conf = Math.round((result.confidence?.[s.key] ?? 0) * 100);
            return (
              <div key={s.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="text-muted-foreground">{conf}%</span>
                </div>
                <Progress value={conf} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {result.note && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-sm text-muted-foreground">{result.note}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Nei prossimi passaggi potrai verificare e correggere tutti i dati prima di salvare.
      </p>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onRetry}>
          Ricarica documenti
        </Button>
        <Button onClick={onContinue}>Verifica dati estratti</Button>
      </div>
    </div>
  );
}
