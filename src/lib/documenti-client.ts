import type { DocumentoArchiviato, Fonte, UploadedFile } from "@/lib/types";

// I documenti stanno in un bucket privato: il link si ottiene firmando il
// percorso lato server. Il frammento #page= viene onorato dai lettori PDF dei
// browser, così il documento si apre direttamente sulla pagina della fonte.
export async function apriDocumento(path: string, pagina: number): Promise<void> {
  const res = await fetch(`/api/documento-url?path=${encodeURIComponent(path)}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Documento non disponibile");

  const url = pagina > 0 ? `${json.url}#page=${pagina}` : json.url;
  window.open(url, "_blank", "noopener");
}

export function percorsoDocumento(
  documenti: UploadedFile[],
  fonte: Fonte | undefined
): string | null {
  if (!fonte) return null;
  return documenti.find((d) => d.name === fonte.documento)?.path ?? null;
}

// Il pulsante di rilettura diceva solo l'anno del bilancio collegato, non
// quale documento avrebbe riletto. Con due rendiconti di esercizi consecutivi
// finiti sotto lo stesso anno, "Rianalizza 2024" rileggeva il documento
// sbagliato e non c'era modo di accorgersene prima di cliccare. Il nome del
// file lo dice.
export function etichettaDocumento(doc: DocumentoArchiviato): string {
  return doc.nome.replace(/\.[a-z0-9]{2,4}$/i, "");
}
