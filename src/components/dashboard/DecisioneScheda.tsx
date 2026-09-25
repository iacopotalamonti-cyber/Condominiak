"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DecisioneScheda({ id }: { id: string }) {
  const router = useRouter();
  const [lavorando, setLavorando] = useState<"approva" | "rifiuta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function decidi(decisione: "approva" | "rifiuta") {
    setLavorando(decisione);
    setErrore(null);
    const res = await fetch("/api/schede", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decisione }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setLavorando(null);
    if (!json.success) {
      setErrore(json.error || "Decisione non salvata");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => decidi("approva")} disabled={lavorando !== null}>
        {lavorando === "approva" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Approva
      </Button>
      <Button size="sm" variant="outline" onClick={() => decidi("rifiuta")} disabled={lavorando !== null}>
        {lavorando === "rifiuta" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        Rifiuta
      </Button>
      {errore && <span className="text-sm text-destructive">{errore}</span>}
    </div>
  );
}
