"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function AnalyzingStep({ statusText }: { statusText: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-8 animate-pulse text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Analisi AI in corso</h2>
        <p className="mt-1 text-sm text-muted-foreground">{statusText}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {elapsed}s — documenti lunghi possono richiedere anche qualche minuto
        </p>
      </div>
    </div>
  );
}
