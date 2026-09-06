"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Progress } from "@/components/ui/progress";

const FASI = [
  "Lettura documenti…",
  "Riconoscimento tabelle millesimali…",
  "Estrazione dati bilancio…",
  "Analisi impianti e contratti…",
  "Verifica coerenza dati…",
];

export function AnalyzingStep() {
  const [pct, setPct] = useState(5);
  const [faseIdx, setFaseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPct((p) => (p < 90 ? p + Math.random() * 8 : p));
    }, 500);
    const faseInterval = setInterval(() => {
      setFaseIdx((i) => Math.min(i + 1, FASI.length - 1));
    }, 1800);
    return () => {
      clearInterval(interval);
      clearInterval(faseInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-8 animate-pulse text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Analisi AI in corso</h2>
        <p className="mt-1 text-sm text-muted-foreground">{FASI[faseIdx]}</p>
      </div>
      <div className="w-full max-w-sm">
        <Progress value={Math.min(pct, 95)} />
      </div>
    </div>
  );
}
