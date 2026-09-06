"use client";

import { Wrench } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiFieldWrapper } from "./AiFieldWrapper";
import { IMPIANTI_LABEL } from "@/lib/condotwin-calculations";
import type { ExtractedImpianti, ExtractedImpiantiDettagli, ExtractedImpiantoDettaglio } from "@/lib/types";

interface ImpiantiStepProps {
  imp: ExtractedImpianti;
  onImpChange: (imp: ExtractedImpianti) => void;
  impDet: ExtractedImpiantiDettagli;
  onImpDetChange: (impDet: ExtractedImpiantiDettagli) => void;
  aiFilled: boolean;
}

const DETTAGLIABILI: (keyof ExtractedImpianti)[] = ["riscaldamento", "ascensore", "areeVerdi", "citofono"];

export function ImpiantiStep({ imp, onImpChange, impDet, onImpDetChange, aiFilled }: ImpiantiStepProps) {
  function toggle(key: keyof ExtractedImpianti, value: boolean) {
    onImpChange({ ...imp, [key]: value });
  }

  function updateDet(key: keyof ExtractedImpiantiDettagli, patch: Partial<ExtractedImpiantoDettaglio>) {
    onImpDetChange({ ...impDet, [key]: { ...impDet[key], ...patch } });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Wrench className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Impianti e servizi</h2>
          <p className="text-sm text-muted-foreground">
            Seleziona gli impianti presenti e i relativi dettagli contrattuali.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.keys(imp) as (keyof ExtractedImpianti)[]).map((key) => {
          const presente = imp[key];
          const det = impDet[key as keyof ExtractedImpiantiDettagli];
          const dettagliabile = DETTAGLIABILI.includes(key);

          return (
            <Card key={key} className={presente ? "border-primary/40" : ""}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`imp-${key}`}
                    checked={presente}
                    onCheckedChange={(c) => toggle(key, Boolean(c))}
                  />
                  <Label htmlFor={`imp-${key}`} className="text-sm font-medium">
                    {IMPIANTI_LABEL[key] ?? key}
                  </Label>
                </div>

                {presente && dettagliabile && (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    {"marca" in (det ?? {}) || key !== "areeVerdi" ? (
                      <div className="col-span-2 flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">
                          {key === "areeVerdi" ? "Fornitore" : "Marca"}
                        </Label>
                        <AiFieldWrapper fromAi={aiFilled && Boolean(det?.marca || det?.fornitore)}>
                          <Input
                            className="h-8 text-sm"
                            value={key === "areeVerdi" ? det?.fornitore ?? "" : det?.marca ?? ""}
                            onChange={(e) =>
                              updateDet(
                                key as keyof ExtractedImpiantiDettagli,
                                key === "areeVerdi" ? { fornitore: e.target.value } : { marca: e.target.value }
                              )
                            }
                          />
                        </AiFieldWrapper>
                      </div>
                    ) : null}
                    {key !== "areeVerdi" && key !== "citofono" && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">Anno install.</Label>
                        <AiFieldWrapper fromAi={aiFilled && Boolean(det?.anno)}>
                          <Input
                            className="h-8 text-sm"
                            value={det?.anno ?? ""}
                            onChange={(e) => updateDet(key as keyof ExtractedImpiantiDettagli, { anno: e.target.value })}
                          />
                        </AiFieldWrapper>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Ultima revisione</Label>
                      <AiFieldWrapper fromAi={aiFilled && Boolean(det?.ultima)}>
                        <Input
                          className="h-8 text-sm"
                          value={det?.ultima ?? ""}
                          onChange={(e) => updateDet(key as keyof ExtractedImpiantiDettagli, { ultima: e.target.value })}
                        />
                      </AiFieldWrapper>
                    </div>
                    {key !== "citofono" && (
                      <>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">Ditta contratto</Label>
                          <AiFieldWrapper fromAi={aiFilled && Boolean(det?.contratto)}>
                            <Input
                              className="h-8 text-sm"
                              value={det?.contratto ?? ""}
                              onChange={(e) =>
                                updateDet(key as keyof ExtractedImpiantiDettagli, { contratto: e.target.value })
                              }
                            />
                          </AiFieldWrapper>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">Scadenza (es. Mar 2025)</Label>
                          <AiFieldWrapper fromAi={aiFilled && Boolean(det?.scad)}>
                            <Input
                              className="h-8 text-sm"
                              value={det?.scad ?? ""}
                              onChange={(e) => updateDet(key as keyof ExtractedImpiantiDettagli, { scad: e.target.value })}
                            />
                          </AiFieldWrapper>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
