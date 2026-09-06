"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoDocumento } from "@/lib/types";

const TIPI: { value: TipoDocumento; label: string }[] = [
  { value: "verbale", label: "Verbale assemblea" },
  { value: "bilancio", label: "Bilancio" },
  { value: "contratto", label: "Contratto" },
  { value: "assicurazione", label: "Assicurazione" },
  { value: "certificazione", label: "Certificazione" },
  { value: "altro", label: "Altro" },
];

export function DocumentUploadForm({ condominiumId }: { condominiumId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoDocumento>("altro");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${condominiumId}/${Date.now()}-${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from("documenti-condominiali")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("documenti").insert({
        condominium_id: condominiumId,
        nome: file.name,
        tipo,
        storage_path: path,
      });
      if (insertErr) throw insertErr;

      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento fallito");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="doc-file">Nuovo documento</Label>
        <Input
          id="doc-file"
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPI.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
        Carica
      </Button>
      {error && <p className="text-sm text-destructive sm:basis-full">{error}</p>}
    </div>
  );
}
