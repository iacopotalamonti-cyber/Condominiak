"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Unita } from "@/lib/types";

export function UnitSelector({ unita, selectedId }: { unita: Unita[]; selectedId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("unitaId", value);
    router.push(`/dashboard/appartamento?${params.toString()}`);
  }

  return (
    <Select value={selectedId} onValueChange={handleChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Seleziona unità" />
      </SelectTrigger>
      <SelectContent>
        {unita.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            Int. {u.interno} {u.nome_proprietario ? `— ${u.nome_proprietario}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
