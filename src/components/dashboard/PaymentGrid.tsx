import { MESI_LABEL } from "@/lib/condotwin-calculations";
import { cn } from "@/lib/utils";
import type { Pagamento, Unita } from "@/lib/types";

interface PaymentGridProps {
  unita: Unita[];
  pagamenti: Pagamento[];
}

const STATO_CLASSES: Record<string, string> = {
  ok: "bg-success",
  ritardo: "bg-warning",
  non_pagato: "bg-destructive",
};

const STATO_LABEL: Record<string, string> = {
  ok: "Pagato",
  ritardo: "In ritardo",
  non_pagato: "Non pagato",
};

export function PaymentGrid({ unita, pagamenti }: PaymentGridProps) {
  const byUnita = new Map<string, Map<number, Pagamento>>();
  for (const p of pagamenti) {
    if (!byUnita.has(p.unita_id)) byUnita.set(p.unita_id, new Map());
    byUnita.get(p.unita_id)!.set(p.mese, p);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card px-2 py-1 text-left font-medium text-muted-foreground">
              Unità
            </th>
            {MESI_LABEL.map((m) => (
              <th key={m} className="px-1 py-1 font-medium text-muted-foreground">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {unita.map((u) => (
            <tr key={u.id}>
              <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1 font-medium">
                Int. {u.interno} {u.nome_proprietario ? `— ${u.nome_proprietario}` : ""}
              </td>
              {MESI_LABEL.map((_, i) => {
                const p = byUnita.get(u.id)?.get(i + 1);
                const stato = p?.stato ?? "ok";
                return (
                  <td key={i} className="p-0.5">
                    <div
                      title={STATO_LABEL[stato]}
                      className={cn("size-5 rounded-sm", STATO_CLASSES[stato])}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(STATO_LABEL).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("size-3 rounded-sm", STATO_CLASSES[key])} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
