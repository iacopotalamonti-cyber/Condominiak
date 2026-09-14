"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { BUCKET, TIPI_ACCETTATI, caricaSuStorage } from "@/lib/extraction-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UploadedFile } from "@/lib/types";

interface UploadStepProps {
  onAnalyze: (files: UploadedFile[]) => void;
  onSkip: () => void;
}

export function UploadStep({ onAnalyze, onSkip }: UploadStepProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (fileList: FileList) => {
    const accettati = Array.from(fileList).filter((f) => TIPI_ACCETTATI.includes(f.type));
    if (!accettati.length) return;

    setUploading(true);
    setError(null);
    try {
      const caricati = await caricaSuStorage(accettati);
      setFiles((prev) => [...prev, ...caricati]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento fallito");
    } finally {
      setUploading(false);
    }
  }, []);

  async function removeFile(index: number) {
    const file = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([file.path]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Carica i documenti del condominio</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bilanci, verbali di assemblea, tabelle millesimali, contratti: l&apos;AI estrarrà
          automaticamente tutti i dati disponibili.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed transition-colors ${
          dragActive ? "border-primary bg-accent" : "border-input"
        }`}
      >
        <CardContent className="flex flex-col items-center gap-3 py-12">
          {uploading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {uploading ? (
              "Caricamento in corso…"
            ) : (
              <>
                Trascina qui i file oppure{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline underline-offset-2"
                  onClick={() => inputRef.current?.click()}
                >
                  sfoglia
                </button>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP — max 50MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={TIPI_ACCETTATI.join(",")}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => (
            <div
              key={`${f.path}-${i}`}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              {f.type === "application/pdf" ? (
                <FileText className="size-4 text-muted-foreground" />
              ) : (
                <ImageIcon className="size-4 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onSkip}>
          Salta e inserisci i dati manualmente
        </Button>
        <Button disabled={files.length === 0 || uploading} onClick={() => onAnalyze(files)}>
          Analizza con AI ({files.length})
        </Button>
      </div>
    </div>
  );
}
