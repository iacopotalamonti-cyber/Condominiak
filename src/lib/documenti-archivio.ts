import { createServiceRoleClient } from "@/lib/supabase/server";
import type { DocumentoArchiviato } from "@/lib/types";

export const BUCKET = "documenti-condominiali";

// I documenti analizzati vengono spostati qui e ci restano: la provenienza di
// un importo serve a poco se il documento a cui rimanda è sparito.
const CARTELLA_ARCHIVIO = "documenti";

const PREFISSO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export function nomeFile(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(PREFISSO_UUID, "");
}

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
 * La cartella è `documenti/{utente}/`, che nessuna policy di Storage copre —
 * si legge quindi con la service role key, restringendo alla cartella di chi
 * sta guardando, come fa la rotta che firma i link.
 */
export async function documentiArchiviati(
  userId: string,
  bilanci: RigaBilancio[]
): Promise<DocumentoArchiviato[]> {
  const cartella = `${CARTELLA_ARCHIVIO}/${userId}`;
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
