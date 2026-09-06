import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUploadForm } from "@/components/dashboard/DocumentUploadForm";
import { DocumentsTable } from "@/components/dashboard/DocumentsTable";
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
    </div>
  );
}
