"use client";

import { Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ExtractedUnita } from "@/lib/types";

interface UnitaStepProps {
  unita: ExtractedUnita[];
  onChange: (unita: ExtractedUnita[]) => void;
  aiFilled: boolean;
}

const EMPTY_UNITA: ExtractedUnita = { int: 0, piano: "", mq: 0, ml: 0, nome: "", email: "", tel: "" };

export function UnitaStep({ unita, onChange, aiFilled }: UnitaStepProps) {
  const totaleMillesimi = unita.reduce((s, u) => s + (u.ml || 0), 0);

  function update(index: number, patch: Partial<ExtractedUnita>) {
    onChange(unita.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  function addRow() {
    const nextInt = (Math.max(0, ...unita.map((u) => u.int)) || 0) + 1;
    onChange([...unita, { ...EMPTY_UNITA, int: nextInt }]);
  }

  function removeRow(index: number) {
    onChange(unita.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Unità immobiliari e millesimi</h2>
            <p className="text-sm text-muted-foreground">
              Verifica appartamenti, proprietari e millesimi di proprietà.
            </p>
          </div>
        </div>
        <Badge variant={Math.round(totaleMillesimi) === 1000 ? "success" : "warning"}>
          Totale millesimi: {totaleMillesimi.toFixed(2)} / 1000
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Int.</TableHead>
              <TableHead className="w-20">Piano</TableHead>
              <TableHead className="w-24">Mq</TableHead>
              <TableHead className="w-28">Millesimi</TableHead>
              <TableHead>Proprietario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {unita.map((u, i) => (
              <TableRow key={i} className={aiFilled && u.nome ? "bg-sky-50 dark:bg-sky-950/20" : ""}>
                <TableCell>
                  <Input
                    className="w-14"
                    type="number"
                    value={u.int || ""}
                    onChange={(e) => update(i, { int: parseInt(e.target.value, 10) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input className="w-16" value={u.piano} onChange={(e) => update(i, { piano: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-20"
                    type="number"
                    value={u.mq || ""}
                    onChange={(e) => update(i, { mq: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-24"
                    type="number"
                    step="0.01"
                    value={u.ml || ""}
                    onChange={(e) => update(i, { ml: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input value={u.nome} onChange={(e) => update(i, { nome: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input
                    type="email"
                    value={u.email}
                    onChange={(e) => update(i, { email: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input value={u.tel} onChange={(e) => update(i, { tel: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" className="self-start" onClick={addRow}>
        <Plus className="size-4" />
        Aggiungi unità
      </Button>
    </div>
  );
}
