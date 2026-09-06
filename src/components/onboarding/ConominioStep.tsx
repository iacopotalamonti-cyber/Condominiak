"use client";

import { Building2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AiFieldWrapper } from "./AiFieldWrapper";
import type { ExtractedInfo } from "@/lib/types";

interface ConominioStepProps {
  info: ExtractedInfo;
  onChange: (info: ExtractedInfo) => void;
  aiFilled: boolean;
}

export function ConominioStep({ info, onChange, aiFilled }: ConominioStepProps) {
  function set<K extends keyof ExtractedInfo>(key: K, value: ExtractedInfo[K]) {
    onChange({ ...info, [key]: value });
  }

  const field = (key: keyof ExtractedInfo) => aiFilled && Boolean(info[key]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Dati dell&apos;edificio</h2>
          <p className="text-sm text-muted-foreground">
            Verifica e correggi le informazioni anagrafiche del condominio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="via">Indirizzo (via e civico)</Label>
          <AiFieldWrapper fromAi={field("via")}>
            <Input
              id="via"
              value={info.via}
              onChange={(e) => set("via", e.target.value)}
              placeholder="Via Roma 12"
            />
          </AiFieldWrapper>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="citta">Città</Label>
          <AiFieldWrapper fromAi={field("citta")}>
            <Input id="citta" value={info.citta} onChange={(e) => set("citta", e.target.value)} />
          </AiFieldWrapper>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cap">CAP</Label>
          <AiFieldWrapper fromAi={field("cap")}>
            <Input id="cap" value={info.cap} onChange={(e) => set("cap", e.target.value)} />
          </AiFieldWrapper>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="annoCostr">Anno di costruzione</Label>
          <AiFieldWrapper fromAi={field("annoCostr")}>
            <Input
              id="annoCostr"
              value={info.annoCostr}
              onChange={(e) => set("annoCostr", e.target.value)}
            />
          </AiFieldWrapper>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="piani">Numero di piani</Label>
          <AiFieldWrapper fromAi={field("piani")}>
            <Input
              id="piani"
              type="number"
              value={info.piani || ""}
              onChange={(e) => set("piani", parseInt(e.target.value, 10) || 0)}
            />
          </AiFieldWrapper>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nApt">Numero di appartamenti</Label>
          <AiFieldWrapper fromAi={field("nApt")}>
            <Input
              id="nApt"
              type="number"
              value={info.nApt || ""}
              onChange={(e) => set("nApt", parseInt(e.target.value, 10) || 0)}
            />
          </AiFieldWrapper>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="pianoTerra"
            checked={info.pianoTerra}
            onCheckedChange={(c) => set("pianoTerra", Boolean(c))}
          />
          <Label htmlFor="pianoTerra">Presente piano terra</Label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Amministratore</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amm">Nome</Label>
            <AiFieldWrapper fromAi={field("amm")}>
              <Input id="amm" value={info.amm} onChange={(e) => set("amm", e.target.value)} />
            </AiFieldWrapper>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emailAmm">Email</Label>
            <AiFieldWrapper fromAi={field("emailAmm")}>
              <Input
                id="emailAmm"
                type="email"
                value={info.emailAmm}
                onChange={(e) => set("emailAmm", e.target.value)}
              />
            </AiFieldWrapper>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telAmm">Telefono</Label>
            <AiFieldWrapper fromAi={field("telAmm")}>
              <Input id="telAmm" value={info.telAmm} onChange={(e) => set("telAmm", e.target.value)} />
            </AiFieldWrapper>
          </div>
        </div>
      </div>
    </div>
  );
}
