"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Documento } from "@/lib/types";

const TIPO_LABEL: Record<string, string> = {
  verbale: "Verbale",
  bilancio: "Bilancio",
  contratto: "Contratto",
  assicurazione: "Assicurazione",
  certificazione: "Certificazione",
  altro: "Altro",
};

export function DocumentsTable({ documenti, canDelete }: { documenti: Documento[]; canDelete: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDownload(doc: Documento) {
    if (!doc.storage_path) return;
    setBusyId(doc.id);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("documenti-condominiali")
      .createSignedUrl(doc.storage_path, 60);
    setBusyId(null);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleDelete(doc: Documento) {
    setBusyId(doc.id);
    const supabase = createClient();
    if (doc.storage_path) {
      await supabase.storage.from("documenti-condominiali").remove([doc.storage_path]);
    }
    await supabase.from("documenti").delete().eq("id", doc.id);
    setBusyId(null);
    router.refresh();
  }

  if (!documenti.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nessun documento caricato.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Caricato il</TableHead>
          <TableHead>AI</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documenti.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="flex items-center gap-2 font-medium">
              <FileText className="size-4 text-muted-foreground" />
              {doc.nome}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{TIPO_LABEL[doc.tipo ?? "altro"] ?? doc.tipo}</Badge>
            </TableCell>
            <TableCell>{new Date(doc.created_at).toLocaleDateString("it-IT")}</TableCell>
            <TableCell>
              {doc.ai_processed ? (
                <Badge variant="success">Analizzato</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === doc.id}
                  onClick={() => handleDownload(doc)}
                >
                  {busyId === doc.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </Button>
                {canDelete && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
