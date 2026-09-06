"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UploadedFile } from "@/lib/types";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface UploadStepProps {
  onAnalyze: (files: UploadedFile[]) => void;
  onSkip: () => void;
}

export function UploadStep({ onAnalyze, onSkip }: UploadStepProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (fileList: FileList) => {
    const accepted = Array.from(fileList).filter((f) => ACCEPTED.includes(f.type));
    const converted = await Promise.all(
      accepted.map(async (f) => ({
        name: f.name,
        type: f.type,
        base64: await fileToBase64(f),
      }))
    );
    setFiles((prev) => [...prev, ...converted]);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Carica i documenti del condominio</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bilanci, verbali di assemblea, tabelle millesimali, contratti: l&apos;AI estrarrà
          automaticamente tutti i dati disponibili.
        </p>
      </div>

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
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Trascina qui i file oppure{" "}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2"
              onClick={() => inputRef.current?.click()}
            >
              sfoglia
            </button>
          </p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP — max 50MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
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
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
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
        <Button disabled={files.length === 0} onClick={() => onAnalyze(files)}>
          Analizza con AI ({files.length})
        </Button>
      </div>
    </div>
  );
}
