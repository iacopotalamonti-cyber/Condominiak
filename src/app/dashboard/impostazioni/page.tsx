import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditCondominiumForm } from "@/components/dashboard/EditCondominiumForm";
import { InviteResidentButton } from "@/components/dashboard/InviteResidentButton";
import type { Unita } from "@/lib/types";

export default async function ImpostazioniPage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("unita")
    .select("*")
    .eq("condominium_id", condominium.id)
    .order("interno");

  const unita = (data ?? []) as Unita[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Anagrafica del condominio e gestione degli accessi dei condomini
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati condominio</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCondominiumForm condominium={condominium} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Condomini</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interno</TableHead>
                <TableHead>Proprietario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Accesso</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {unita.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">Int. {u.interno}</TableCell>
                  <TableCell>{u.nome_proprietario || "—"}</TableCell>
                  <TableCell>{u.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.user_id ? "success" : "secondary"}>
                      {u.user_id ? "Attivo" : "Non collegato"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!u.user_id && (
                      <InviteResidentButton unitaId={u.id} interno={u.interno} currentEmail={u.email} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
