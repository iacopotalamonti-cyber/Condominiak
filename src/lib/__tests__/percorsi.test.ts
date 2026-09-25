import { strict as assert } from "node:assert";
import { test } from "node:test";

import { archivia, archiviaTutti, improntaDi, type Contenitore } from "../archivio.ts";
import {
  collocazione,
  destinoAlSalvataggio,
  nomeFile,
  percorsoArchivio,
  puoEstrarre,
  puoLeggere,
} from "../percorsi.ts";

const IO = "8e617a4c-7556-4750-8673-b08677de4f36";
const ALTRO = "aaaaaaaa-0000-4000-8000-000000000002";
const CONDO = "f0b9dfd6-8b20-460a-8b2c-86176f06caa9";
const ALTRO_CONDO = "cccccccc-0000-4000-8000-00000000000b";
const TEMP = `pending/${IO}/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf`;

test("la forma del percorso dice a chi appartiene", () => {
  assert.deepEqual(collocazione(TEMP), { tipo: "temporaneo", utente: IO });
  assert.deepEqual(collocazione(`${CONDO}/documenti/0123456789abcdef-Rendiconto.pdf`), {
    tipo: "condominio",
    condominio: CONDO,
    archivio: true,
  });
  assert.deepEqual(collocazione(`${CONDO}/1789403477588-Verbale.pdf`), {
    tipo: "condominio",
    condominio: CONDO,
    archivio: false,
  });
  assert.deepEqual(collocazione(`documenti/${IO}/x-ENRIQUES 3.pdf`), { tipo: "storico", utente: IO });
});

test("un percorso fuori forma non appartiene a nessuno", () => {
  for (const p of [
    "",
    "pending/non-un-uuid/file.pdf",
    `pending/${IO}/../${ALTRO}/file.pdf`,
    `pending/${IO}//file.pdf`,
    `${CONDO}/altro/file.pdf`,
    `${CONDO}/documenti/sotto/file.pdf`,
    "file.pdf",
  ]) {
    assert.equal(collocazione(p), null, p);
  }
});

test("un documento del condominio lo leggono i suoi membri, non gli altri", () => {
  const p = `${CONDO}/documenti/0123456789abcdef-Rendiconto.pdf`;
  assert.equal(puoLeggere(p, ALTRO, [CONDO]), true);
  assert.equal(puoLeggere(p, IO, [ALTRO_CONDO]), false);
  assert.equal(puoLeggere(p, IO, []), false);
});

test("un file appena caricato lo vede solo chi l'ha caricato", () => {
  assert.equal(puoLeggere(TEMP, IO, []), true);
  assert.equal(puoLeggere(TEMP, ALTRO, [CONDO]), false);
  assert.equal(puoEstrarre(TEMP, IO, []), true);
  assert.equal(puoEstrarre(TEMP, ALTRO, [CONDO]), false);
});

test("rileggere un documento del condominio è da amministratore", () => {
  const p = `${CONDO}/documenti/0123456789abcdef-Rendiconto.pdf`;
  assert.equal(puoEstrarre(p, IO, [CONDO]), true);
  assert.equal(puoEstrarre(p, IO, [ALTRO_CONDO]), false);
});

test("al salvataggio non si può citare il documento di un altro", () => {
  assert.equal(destinoAlSalvataggio(TEMP, IO, CONDO), "archivia");
  assert.equal(destinoAlSalvataggio(TEMP, ALTRO, CONDO), "rifiuta");
  assert.equal(destinoAlSalvataggio(`${CONDO}/documenti/ab-x.pdf`, IO, CONDO), "tieni");
  assert.equal(destinoAlSalvataggio(`${ALTRO_CONDO}/documenti/ab-x.pdf`, IO, CONDO), "rifiuta");
  assert.equal(destinoAlSalvataggio("qualunque/cosa.pdf", IO, CONDO), "rifiuta");
});

test("il nome mostrato è quello caricato, qualunque prefisso abbia", () => {
  assert.equal(nomeFile(TEMP), "ENRIQUES 3.pdf");
  assert.equal(nomeFile(`${CONDO}/documenti/0123456789abcdef-Rendiconto 2024-2025.pdf`), "Rendiconto 2024-2025.pdf");
  assert.equal(nomeFile(`${CONDO}/1789403477588-Verbale 12-3.pdf`), "Verbale 12-3.pdf");
});

test("il nome non può aprire cartelle nel percorso", () => {
  const p = percorsoArchivio(CONDO, "0123456789abcdef0123", "../../altro/x.pdf");
  assert.equal(p, `${CONDO}/documenti/0123456789abcdef-.._.._altro_x.pdf`);
  assert.deepEqual(collocazione(p), { tipo: "condominio", condominio: CONDO, archivio: true });
});

// --- archiviazione, su uno Storage finto ------------------------------------

function storageFinto(file: Record<string, string>) {
  const oggetti = new Map(Object.entries(file));
  const bucket: Contenitore = {
    async download(path) {
      const c = oggetti.get(path);
      return c === undefined ? { data: null, error: { message: "not found" } } : { data: new Blob([c]), error: null };
    },
    async list(cartella, { search }) {
      const data = [...oggetti.keys()]
        .filter((k) => k.startsWith(`${cartella}/`) && k.slice(cartella.length + 1).startsWith(search))
        .map((k) => ({ name: k.slice(cartella.length + 1), id: "x" }));
      return { data, error: null };
    },
    async move(da, a) {
      if (oggetti.has(a)) return { error: { message: "The resource already exists" } };
      oggetti.set(a, oggetti.get(da)!);
      oggetti.delete(da);
      return { error: null };
    },
    async remove(paths) {
      for (const p of paths) oggetti.delete(p);
      return { error: null };
    },
  };
  return { bucket, oggetti };
}

test("un documento salvato passa nell'archivio del condominio", async () => {
  const { bucket, oggetti } = storageFinto({ [TEMP]: "pdf del 2025" });
  const finale = await archivia(bucket, TEMP, "ENRIQUES 3.pdf", IO, CONDO);
  const impronta = improntaDi(new TextEncoder().encode("pdf del 2025"));
  assert.equal(finale, `${CONDO}/documenti/${impronta.slice(0, 16)}-ENRIQUES 3.pdf`);
  assert.deepEqual([...oggetti.keys()], [finale]);
});

test("lo stesso contenuto caricato due volte resta un file solo", async () => {
  const secondo = `pending/${IO}/11111111-2222-4333-8444-555555555555-copia.pdf`;
  const { bucket, oggetti } = storageFinto({ [TEMP]: "stesso pdf", [secondo]: "stesso pdf" });
  const esito = await archiviaTutti(
    bucket,
    [
      { name: "ENRIQUES 3.pdf", path: TEMP },
      { name: "copia.pdf", path: secondo },
    ],
    IO,
    CONDO
  );
  assert.equal(esito.get(TEMP), esito.get(secondo));
  assert.equal(oggetti.size, 1);
});

test("un percorso non citabile non si sposta e non si salva", async () => {
  const altrui = `pending/${ALTRO}/11111111-2222-4333-8444-555555555555-x.pdf`;
  const { bucket, oggetti } = storageFinto({ [altrui]: "di un altro" });
  assert.equal(await archivia(bucket, altrui, "x.pdf", IO, CONDO), null);
  assert.ok(oggetti.has(altrui));
});

test("un documento già in archivio resta dov'è", async () => {
  const p = `${CONDO}/documenti/0123456789abcdef-R.pdf`;
  const { bucket, oggetti } = storageFinto({ [p]: "x" });
  assert.equal(await archivia(bucket, p, "R.pdf", IO, CONDO), p);
  assert.ok(oggetti.has(p));
});
