"use client";

import { Loader2, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/calcoli";
import type { ExtractedBilancio, ExtractedInfo, ExtractedUnita } from "@/lib/types";

interface AntepimaStepProps {
  info: ExtractedInfo;
  unita: ExtractedUnita[];
  bilanci: ExtractedBilancio[];
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

export function AntepimaStep({ info, unita, bilanci, onSubmit, submitting, error }: AntepimaStepProps) {
  const ultimoBilancio = bilanci.find((b) => b.cons);
  const totaleMillesimi = unita.reduce((s, u) => s + (u.ml || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <PartyPopper className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Riepilogo e conferma</h2>
          <p className="text-sm text-muted-foreground">
            Controlla i dati riassuntivi prima di creare il condominio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edificio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="font-medium">
              {info.via}, {info.citta} {info.cap}
            </p>
            <p className="text-muted-foreground">
              {info.piani} piani · {info.nApt} appartamenti
              {info.pianoTerra ? " · con piano terra" : ""}
            </p>
            {info.amm && (
              <p className="text-muted-foreground">
                Amministratore: {info.amm} {info.emailAmm ? `(${info.emailAmm})` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unità e millesimi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>{unita.length} unità immobiliari registrate</p>
            <Badge variant={Math.round(totaleMillesimi) === 1000 ? "success" : "warning"} className="w-fit">
              Totale millesimi: {totaleMillesimi.toFixed(2)} / 1000
            </Badge>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Bilancio più recente</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm">
            {ultimoBilancio ? (
              <>
                <div>
                  <p className="text-muted-foreground">Anno</p>
                  <p className="font-medium">{ultimoBilancio.anno}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Consuntivo</p>
                  <p className="font-medium">{formatEuro(ultimoBilancio.cons)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fondo riserva</p>
                  <p className="font-medium">{formatEuro(ultimoBilancio.fondo)}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Nessun dato di bilancio inserito</p>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button size="lg" onClick={onSubmit} disabled={submitting} className="self-end">
        {submitting && <Loader2 className="animate-spin" />}
        Crea condominio e vai alla dashboard
      </Button>
    </div>
  );
}
