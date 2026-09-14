"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AnnoSelector({ anni, selezionato }: { anni: number[]; selezionato: number }) {
  const router = useRouter();

  return (
    <Select
      value={String(selezionato)}
      onValueChange={(anno) => router.push(`/dashboard/spese?anno=${anno}`)}
    >
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Anno" />
      </SelectTrigger>
      <SelectContent>
        {anni.map((anno) => (
          <SelectItem key={anno} value={String(anno)}>
            {anno}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
