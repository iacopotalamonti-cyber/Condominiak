import { notFound } from "next/navigation";

import { DecisioneScheda } from "@/components/dashboard/DecisioneScheda";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORIE_SPESA_LABEL, formatEuroPreciso } from "@/lib/calcoli";
import { getDashboardContext } from "@/lib/dashboard-context";
import type { Verifica } from "@/lib/scheda";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface RigaScheda {
  id: string;
  nome: string;
  scheda: unknown;
  verifica: Verifica;
  stato: "proposta" | "approvata" | "rifiutata";
  documento_nome: string | null;
  created_at: string;
  deciso_il: string | null;
}

const data = (iso: string) => new Date(iso).toLocaleDateString("it-IT");
const categoria = (c: string | null) =>
  c === null ? "senza categoria" : c === "rimborso" ? "Rimborso (entrata)" : (CATEGORIE_SPESA_LABEL[c] ?? c);

// Le schede di formato proposte dal modello. Qui si guarda ciò che la scheda
// ha letto sul documento da cui è nata — voce per voce, con la categoria — e
// si decide se usarla per tutti i rendiconti di quel formato. La quadratura
// l'ha già verificata la funzione: questa pagina serve a controllare ciò che
// una quadratura non vede, cioè che ogni voce sia finita nella categoria giusta.
export default async function FormatiPage() {
  const { operatore } = await getDashboardContext();
  if (!operatore) notFound();

  const { data: righe } = await createServiceRoleClient()
    .from("schede_formato")
    .select("id, nome, scheda, verifica, stato, documento_nome, created_at, deciso_il")
    .order("created_at", { ascending: false })
    .limit(100);

  const schede = (righe ?? []) as RigaScheda[];
  const proposte = schede.filter((s) => s.stato === "proposta");
  const decise = schede.filter((s) => s.stato !== "proposta");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Formati dei rendiconti</h1>
        <p className="text-sm text-muted-foreground">
          Quando arriva un rendiconto di un formato sconosciuto, il modello ne propone la scheda.
          Una scheda approvata legge da sola, senza modello, tutti i rendiconti di quel formato.
        </p>
      </div>

      {!proposte.length && (
        <p className="text-sm text-muted-foreground">Nessuna scheda in attesa di approvazione.</p>
      )}

      {proposte.map((s) => (
        <Card key={s.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{s.nome}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Proposta il {data(s.created_at)}
                {s.documento_nome ? ` leggendo «${s.documento_nome}»` : ""}
              </p>
            </div>
            <DecisioneScheda id={s.id} />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success">
                Scarto {formatEuroPreciso(s.verifica.scarto ?? 0)} sul totale stampato
              </Badge>
              <Badge variant="secondary">
                Totale stampato {s.verifica.totaleStampato === null ? "—" : formatEuroPreciso(s.verifica.totaleStampato)}
              </Badge>
              <Badge variant="secondary">Esercizio {s.verifica.anno ?? "?"}</Badge>
              <Badge variant="secondary">{s.verifica.voci.length} voci</Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voce</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.verifica.voci.map((v) => (
                  <TableRow key={v.chiave}>
                    <TableCell className="font-mono text-xs">{v.chiave}</TableCell>
                    <TableCell className="max-w-md truncate">{v.descrizione}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuroPreciso(v.importo)}</TableCell>
                    <TableCell>{categoria(v.categoria)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">La scheda, come la esegue il motore</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(s.scheda, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ))}

      {decise.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Già decise</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {decise.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>
                      <Badge variant={s.stato === "approvata" ? "success" : "secondary"}>
                        {s.stato === "approvata" ? "Approvata" : "Rifiutata"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.deciso_il ? data(s.deciso_il) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
