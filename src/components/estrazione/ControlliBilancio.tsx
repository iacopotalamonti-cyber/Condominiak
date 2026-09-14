"use client";

import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Controllo } from "@/lib/types";

interface ControlliBilancioProps {
  controlli: Controllo[];
  // Mostrato quando non c'è nulla da segnalare, per dire che il controllo
  // è stato fatto invece di limitarsi al silenzio.
  messaggioOk?: string;
}

// I controlli aritmetici sono l'unica parte della verifica che non dipende dal
// modello: se le voci non sommano al totale stampato, uno dei due numeri è
// sbagliato, comunque il modello si dichiari sicuro.
export function ControlliBilancio({ controlli, messaggioOk }: ControlliBilancioProps) {
  if (!controlli.length) {
    if (!messaggioOk) return null;
    return (
      <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
        <CircleCheck className="size-4 shrink-0" />
        {messaggioOk}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {controlli.map((controllo, i) => {
        const errore = controllo.livello === "errore";
        const Icona = errore ? CircleX : TriangleAlert;
        return (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
              errore ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
            )}
          >
            <Icona className="mt-0.5 size-4 shrink-0" />
            <span>{controllo.messaggio}</span>
          </li>
        );
      })}
    </ul>
  );
}
