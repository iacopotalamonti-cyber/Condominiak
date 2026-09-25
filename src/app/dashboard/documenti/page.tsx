import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUploadForm } from "@/components/dashboard/DocumentUploadForm";
import { DocumentsTable } from "@/components/dashboard/DocumentsTable";
import { ApriDocumento } from "@/components/dashboard/ApriDocumento";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { documentiArchiviati } from "@/lib/documenti-archivio";
import type { Documento } from "@/lib/types";

export default async function DocumentiPage() {
  const { role, condominium } = await getDashboardContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("documenti")
    .select("*")
    .eq("condominium_id", condominium.id)
    .order("created_at", { ascending: false });

  const documenti = (data ?? []) as Documento[];

  // I rendiconti da cui l'app ha letto i numeri stanno in una cartella a
  // parte: senza mostrarli qui, chi cercava i documenti del condominio non li
  // trovava.
  const { data: datiBilanci } = await supabase
    .from("bilanci")
    .select("anno, documento_path")
    .eq("condominium_id", condominium.id);
  const rendiconti = await documentiArchiviati(
    condominium.id,
    (datiBilanci ?? []) as { anno: number; documento_path: string | null }[]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Documenti</h1>
        <p className="text-sm text-muted-foreground">
          Archivio dei documenti del condominio: verbali, bilanci, contratti e certificazioni
        </p>
      </div>

      {role === "admin" && <DocumentUploadForm condominiumId={condominium.id} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivio documenti</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentsTable documenti={documenti} canDelete={role === "admin"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rendiconti letti dall&apos;app</CardTitle>
          <p className="text-sm text-muted-foreground">
            I documenti da cui vengono i numeri di bilanci, spese e quote. Si aggiungono da
            Analisi spese, e restano qui anche se l&apos;esercizio viene cancellato.
          </p>
        </CardHeader>
        <CardContent>
          {rendiconti.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Esercizio</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rendiconti.map((doc) => (
                  <TableRow key={doc.path}>
                    <TableCell className="font-medium">{doc.nome}</TableCell>
                    <TableCell>{doc.anno ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <ApriDocumento percorso={doc.path} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun rendiconto in archivio.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
