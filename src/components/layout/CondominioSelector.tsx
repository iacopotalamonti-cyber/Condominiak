"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Appartenenza } from "@/lib/appartenenza";

const NUOVO = "__nuovo__";

// Chi appartiene a più condomini passa dall'uno all'altro da qui. Chi ne ha
// uno solo non vede niente: un selettore con una voce sola è rumore.
export function CondominioSelector({
  condomini,
  attivo,
}: {
  condomini: Appartenenza[];
  attivo: string;
}) {
  const router = useRouter();
  const [cambiando, setCambiando] = useState(false);

  async function cambia(valore: string) {
    if (valore === NUOVO) {
      router.push("/onboarding");
      return;
    }
    setCambiando(true);
    const res = await fetch("/api/condominio-attivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condominiumId: valore }),
    });
    setCambiando(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  if (condomini.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      {cambiando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <Select value={attivo} onValueChange={cambia}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Condominio" />
        </SelectTrigger>
        <SelectContent>
          {condomini.map(({ condominium, ruolo }) => (
            <SelectItem key={condominium.id} value={condominium.id}>
              {condominium.via}
              {condominium.civico ? ` ${condominium.civico}` : ""} ·{" "}
              {ruolo === "admin" ? "gestisci" : "condomino"}
            </SelectItem>
          ))}
          <SelectItem value={NUOVO}>+ Registra un altro condominio</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
