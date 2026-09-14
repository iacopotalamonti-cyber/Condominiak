"use client";

import { Plus, Trash2, Wallet } from "lucide-react";

import {
  CAMPI_IMPORTO,
  bilancioVuoto,
  controlliBilancio,
  etichettaCampo,
  leggiImporto,
  scriviImporto,
  sommaSpese,
} from "@/lib/anthropic";
import { percorsoDocumento } from "@/lib/documenti-client";
import { formatEuro } from "@/lib/condotwin-calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampoImporto } from "@/components/estrazione/CampoImporto";
import { ControlliBilancio } from "@/components/estrazione/ControlliBilancio";
import type { CampoImporto as CampoImportoKey, ExtractedBilancio, UploadedFile } from "@/lib/types";

interface BilanciStepProps {
  bilanci: ExtractedBilancio[];
  onBilanciChange: (bilanci: ExtractedBilancio[]) => void;
  documenti: UploadedFile[];
}

const CAMPI_TOTALI: CampoImportoKey[] = ["prev", "cons", "fondo", "totale"];
const CAMPI_SPESA = CAMPI_IMPORTO.filter((c) => c.startsWith("spesa."));

export function BilanciStep({ bilanci, onBilanciChange, documenti }: BilanciStepProps) {
  function aggiorna(indice: number, modifica: (bilancio: ExtractedBilancio) => void) {
    onBilanciChange(
      bilanci.map((bilancio, i) => {
        if (i !== indice) return bilancio;
        const copia: ExtractedBilancio = {
          ...bilancio,
          spese: { ...bilancio.spese },
          fonti: { ...bilancio.fonti },
          conflitti: { ...bilancio.conflitti },
        };
        modifica(copia);
        return copia;
      })
    );
  }

  function aggiungi() {
    const anni = bilanci.map((b) => b.anno).filter(Boolean);
    const anno = anni.length ? Math.min(...anni) - 1 : new Date().getFullYear() - 1;
    // In coda e senza riordinare: la posizione identifica la scheda, e un
    // riordino sposterebbe sotto i piedi quella aperta.
    onBilanciChange([...bilanci, bilancioVuoto(anno)]);
  }

  function rimuovi(indice: number) {
    onBilanciChange(bilanci.filter((_, i) => i !== indice));
  }

  // L'anno è modificabile, quindi non può identificare la scheda: due esercizi
  // sullo stesso anno si sovrapporrebbero. La posizione sì.
  const attivo = bilanci.length ? "0" : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <Wallet className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Bilanci e voci di spesa</h2>
          <p className="text-sm text-muted-foreground">
            Un esercizio per scheda, con le sue voci di spesa. Sotto ogni importo trovi la pagina
            del documento da cui è stato letto: aprila se un numero non ti torna.
          </p>
        </div>
      </div>

      {!bilanci.length ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Nessun esercizio: aggiungine uno e compilalo a mano, oppure torna indietro e carica i
            bilanci.
          </p>
          <Button variant="outline" onClick={aggiungi}>
            <Plus />
            Aggiungi un esercizio
          </Button>
        </div>
      ) : (
        <Tabs defaultValue={attivo} className="gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              {bilanci.map((bilancio, indice) => (
                <TabsTrigger key={indice} value={String(indice)}>
                  {bilancio.anno || "Senza anno"}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button variant="outline" size="sm" onClick={aggiungi}>
              <Plus />
              Aggiungi esercizio
            </Button>
          </div>

          {bilanci.map((bilancio, indice) => {
            const controlli = controlliBilancio(bilancio);
            return (
              <TabsContent key={indice} value={String(indice)} className="flex flex-col gap-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-col gap-1.5 sm:max-w-40">
                    <Label htmlFor={`anno-${indice}`}>Anno dell&apos;esercizio</Label>
                    <Input
                      id={`anno-${indice}`}
                      type="number"
                      value={bilancio.anno || ""}
                      onChange={(e) =>
                        aggiorna(indice, (b) => {
                          b.anno = parseInt(e.target.value, 10) || 0;
                        })
                      }
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => rimuovi(indice)}>
                    <Trash2 />
                    Rimuovi esercizio
                  </Button>
                </div>

                <ControlliBilancio
                  controlli={controlli}
                  messaggioOk="I conti di questo esercizio tornano."
                />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {CAMPI_TOTALI.map((campo) => (
                    <CampoImporto
                      key={campo}
                      id={`${indice}-${campo}`}
                      etichetta={etichettaCampo(campo)}
                      valore={leggiImporto(bilancio, campo)}
                      fonte={bilancio.fonti[campo]}
                      conflitti={bilancio.conflitti[campo]}
                      percorso={percorsoDocumento(documenti, bilancio.fonti[campo])}
                      onChange={(v) =>
                        aggiorna(indice, (b) => {
                          scriviImporto(b, campo, v);
                          delete b.conflitti[campo];
                        })
                      }
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Voci di spesa {bilancio.anno || ""}</span>
                    <span className="text-muted-foreground">
                      Somma delle voci: {formatEuro(sommaSpese(bilancio.spese))}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {CAMPI_SPESA.map((campo) => (
                      <CampoImporto
                        key={campo}
                        id={`${indice}-${campo}`}
                        etichetta={etichettaCampo(campo)}
                        valore={leggiImporto(bilancio, campo)}
                        fonte={bilancio.fonti[campo]}
                        conflitti={bilancio.conflitti[campo]}
                        percorso={percorsoDocumento(documenti, bilancio.fonti[campo])}
                        onChange={(v) =>
                          aggiorna(indice, (b) => {
                            scriviImporto(b, campo, v);
                            delete b.conflitti[campo];
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
