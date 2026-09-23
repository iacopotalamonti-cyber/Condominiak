"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnnoSelectorProps {
  anni: number[];
  // Stringa quando la selezione è un'opzione non numerica come "tutti".
  selezionato: number | string;
  // Pagina su cui applicare il filtro: il selettore serve a più pagine, e
  // rimandare sempre ad Analisi spese lo rendeva inutilizzabile altrove.
  base?: string;
  // Valore aggiuntivo in elenco, per "tutti gli anni".
  opzioneTutti?: { valore: string; etichetta: string };
}

export function AnnoSelector({
  anni,
  selezionato,
  base = "/dashboard/spese",
  opzioneTutti,
}: AnnoSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Gli altri parametri restano: sulla pagina appartamento c'è anche l'unità
  // scelta, e cambiare anno riportava l'amministratore al primo appartamento.
  function cambia(anno: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("anno", anno);
    router.push(`${base}?${params.toString()}`);
  }

  return (
    <Select value={String(selezionato)} onValueChange={cambia}>
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Anno" />
      </SelectTrigger>
      <SelectContent>
        {opzioneTutti && (
          <SelectItem value={opzioneTutti.valore}>{opzioneTutti.etichetta}</SelectItem>
        )}
        {anni.map((anno) => (
          <SelectItem key={anno} value={String(anno)}>
            {anno}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
