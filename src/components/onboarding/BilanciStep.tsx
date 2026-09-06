"use client";

import { Wallet } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiFieldWrapper } from "./AiFieldWrapper";
import { CATEGORIE_SPESA_LABEL } from "@/lib/condotwin-calculations";
import type { ExtractedBilancio, ExtractedSpese } from "@/lib/types";

interface BilanciStepProps {
  bilanci: ExtractedBilancio[];
  onBilanciChange: (bilanci: ExtractedBilancio[]) => void;
  spese: ExtractedSpese;
  onSpeseChange: (spese: ExtractedSpese) => void;
  aiFilled: boolean;
}

export function BilanciStep({
  bilanci,
  onBilanciChange,
  spese,
  onSpeseChange,
  aiFilled,
}: BilanciStepProps) {
  function updateBilancio(index: number, patch: Partial<ExtractedBilancio>) {
    onBilanciChange(bilanci.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <Wallet className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Bilanci e voci di spesa</h2>
          <p className="text-sm text-muted-foreground">
            Preventivo, consuntivo e fondo riserva degli ultimi 5 anni.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Anno</TableHead>
              <TableHead>Preventivo (€)</TableHead>
              <TableHead>Consuntivo (€)</TableHead>
              <TableHead>Fondo riserva (€)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bilanci.map((b, i) => (
              <TableRow key={b.anno}>
                <TableCell className="font-medium">{b.anno}</TableCell>
                <TableCell>
                  <AiFieldWrapper fromAi={aiFilled && Boolean(b.prev)}>
                    <Input
                      type="number"
                      value={b.prev || ""}
                      onChange={(e) => updateBilancio(i, { prev: parseFloat(e.target.value) || 0 })}
                    />
                  </AiFieldWrapper>
                </TableCell>
                <TableCell>
                  <AiFieldWrapper fromAi={aiFilled && Boolean(b.cons)}>
                    <Input
                      type="number"
                      value={b.cons || ""}
                      onChange={(e) => updateBilancio(i, { cons: parseFloat(e.target.value) || 0 })}
                    />
                  </AiFieldWrapper>
                </TableCell>
                <TableCell>
                  <AiFieldWrapper fromAi={aiFilled && Boolean(b.fondo)}>
                    <Input
                      type="number"
                      value={b.fondo || ""}
                      onChange={(e) => updateBilancio(i, { fondo: parseFloat(e.target.value) || 0 })}
                    />
                  </AiFieldWrapper>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Voci di spesa (anno corrente)
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(spese) as (keyof ExtractedSpese)[]).map((cat) => (
            <div key={cat} className="flex flex-col gap-1.5">
              <Label htmlFor={`spesa-${cat}`}>{CATEGORIE_SPESA_LABEL[cat] ?? cat}</Label>
              <AiFieldWrapper fromAi={aiFilled && Boolean(spese[cat])}>
                <Input
                  id={`spesa-${cat}`}
                  type="number"
                  value={spese[cat] || ""}
                  onChange={(e) =>
                    onSpeseChange({ ...spese, [cat]: parseFloat(e.target.value) || 0 })
                  }
                />
              </AiFieldWrapper>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
