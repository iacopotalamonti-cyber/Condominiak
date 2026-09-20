import { CheckCircle2, AlertTriangle, XCircle, Wrench } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IMPIANTI_LABEL } from "@/lib/calcoli";
import type { Impianto } from "@/lib/types";

const STATO_META = {
  ok: { label: "Regolare", icon: CheckCircle2, variant: "success" as const },
  warning: { label: "Da verificare", icon: AlertTriangle, variant: "warning" as const },
  critical: { label: "Critico", icon: XCircle, variant: "destructive" as const },
};

export function ImpiantiGrid({ impianti }: { impianti: Impianto[] }) {
  if (!impianti.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <Wrench className="size-6" />
          <p className="text-sm">Nessun impianto registrato per questo condominio.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {impianti.map((imp) => {
        const meta = STATO_META[imp.stato];
        const Icon = meta.icon;
        return (
          <Card key={imp.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-start justify-between">
                <h3 className="font-medium">{IMPIANTI_LABEL[imp.tipo] ?? imp.tipo}</h3>
                <Badge variant={meta.variant}>
                  <Icon className="size-3" />
                  {meta.label}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                {imp.marca && (
                  <>
                    <dt>Marca / fornitore</dt>
                    <dd className="text-right text-foreground">{imp.marca}</dd>
                  </>
                )}
                {imp.anno_installazione && (
                  <>
                    <dt>Anno installazione</dt>
                    <dd className="text-right text-foreground">{imp.anno_installazione}</dd>
                  </>
                )}
                {imp.ultima_revisione && (
                  <>
                    <dt>Ultima revisione</dt>
                    <dd className="text-right text-foreground">{imp.ultima_revisione}</dd>
                  </>
                )}
                {imp.contratto_ditta && (
                  <>
                    <dt>Ditta contratto</dt>
                    <dd className="text-right text-foreground">{imp.contratto_ditta}</dd>
                  </>
                )}
                {imp.scadenza_contratto && (
                  <>
                    <dt>Scadenza contratto</dt>
                    <dd className="text-right text-foreground">{imp.scadenza_contratto}</dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
