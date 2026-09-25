import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditCondominiumForm } from "@/components/dashboard/EditCondominiumForm";
import { InviteResidentButton } from "@/components/dashboard/InviteResidentButton";
import { RevocaInvito } from "@/components/dashboard/RevocaInvito";
import type { Unita } from "@/lib/types";

interface InvitoInAttesa {
  id: string;
  email: string;
  ruolo: "admin" | "resident";
  scade_il: string;
  unita_id: string | null;
}

export default async function ImpostazioniPage() {
  const { condominium } = await getDashboardContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("unita")
    .select("*")
    .eq("condominium_id", condominium.id)
    // Si invitano le persone, e le persone abitano negli appartamenti: box,
    // cantine e posti auto sono nell'anagrafica per il riparto, non qui.
    .eq("tipologia", "appartamento")
    .order("interno");

  const unita = (data ?? []) as Unita[];

  // Chi è collegato a quale unità, e gli inviti non ancora usati. Li vede solo
  // chi gestisce il condominio: la RLS mostra agli altri soltanto i propri.
  const [{ data: collegamenti }, { data: datiInviti }, { count: persone }] = await Promise.all([
    supabase.from("unita_membri").select("unita_id").in("unita_id", unita.map((u) => u.id)),
    supabase
      .from("inviti")
      .select("id, email, ruolo, scade_il, unita_id")
      .eq("condominium_id", condominium.id)
      .is("usato_il", null)
      .gt("scade_il", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("membri")
      .select("id", { count: "exact", head: true })
      .eq("condominium_id", condominium.id),
  ]);

  const collegatiPerUnita = new Map<string, number>();
  for (const c of (collegamenti ?? []) as { unita_id: string }[]) {
    collegatiPerUnita.set(c.unita_id, (collegatiPerUnita.get(c.unita_id) ?? 0) + 1);
  }
  const inviti = (datiInviti ?? []) as InvitoInAttesa[];
  const etichettaDi = (id: string | null) => {
    const u = unita.find((x) => x.id === id);
    return u ? `Int. ${u.interno ?? u.codice}` : "senza unità";
  };

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
                <TableHead>Con accesso</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {unita.map((u) => {
                const collegati = collegatiPerUnita.get(u.id) ?? 0;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">Int. {u.interno ?? u.codice}</TableCell>
                    <TableCell>{u.nome_proprietario || "—"}</TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={collegati ? "success" : "secondary"}>
                        {collegati === 0
                          ? "Nessuno"
                          : collegati === 1
                            ? "1 persona"
                            : `${collegati} persone`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {/* Si invita anche dove c'è già qualcuno: un appartamento
                          può avere più persone, e ognuna ha il suo accesso. */}
                      <InviteResidentButton
                        condominiumId={condominium.id}
                        unitaId={u.id}
                        etichetta={`Int. ${u.interno ?? u.codice}`}
                        currentEmail={u.email}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-muted-foreground">
            {persone ?? 0} {persone === 1 ? "persona ha" : "persone hanno"} accesso a questo
            condominio.
          </p>
        </CardContent>
      </Card>

      {inviti.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inviti in attesa</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Unità</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Scade</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviti.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{etichettaDi(i.unita_id)}</TableCell>
                    <TableCell>{i.ruolo === "admin" ? "Gestisce" : "Condomino"}</TableCell>
                    <TableCell>{new Date(i.scade_il).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>
                      <RevocaInvito invitoId={i.id} />
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
