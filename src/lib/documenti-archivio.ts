import { createServiceRoleClient } from "@/lib/supabase/server";
import { BUCKET, cartellaArchivio, nomeFile } from "@/lib/percorsi";
import type { DocumentoArchiviato } from "@/lib/types";

interface RigaBilancio {
  anno: number;
  documento_path: string | null;
}

/**
 * I documenti in archivio, letti da Storage e non dalle righe di bilancio.
 *
 * Ricavarli dai bilanci faceva sparire dall'interfaccia ogni documento il cui
 * anno fosse stato nel frattempo sovrascritto da un altro rendiconto: il file
 * restava su Storage ma non c'era più modo di rileggerlo. Ed è successo: il
 * rendiconto 2023-2024 è diventato irraggiungibile quando il 2024-2025 ha
 * preso il suo stesso anno.
 *
 * La cartella è `{condominio}/documenti/`: l'archivio è del condominio, non
 * di chi ha caricato i file, così lo vede ogni suo amministratore. Si legge
 * con la service role key; chi chiama ha già verificato di esserne admin.
 */
export async function documentiArchiviati(
  condominiumId: string,
  bilanci: RigaBilancio[]
): Promise<DocumentoArchiviato[]> {
  const cartella = cartellaArchivio(condominiumId);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage.from(BUCKET).list(cartella, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) {
    console.error("Elenco documenti archiviati fallito:", error);
    return [];
  }

  const annoPerPath = new Map<string, number>();
  for (const b of bilanci) {
    if (b.documento_path) annoPerPath.set(b.documento_path, b.anno);
  }

  return data
    // `list` restituisce anche i segnaposto delle cartelle, che non hanno id.
    .filter((oggetto) => oggetto.id)
    .map((oggetto) => {
      const path = `${cartella}/${oggetto.name}`;
      return { anno: annoPerPath.get(path) ?? null, nome: nomeFile(path), path };
    })
    .sort((a, b) => (b.anno ?? 0) - (a.anno ?? 0) || a.nome.localeCompare(b.nome));
}
