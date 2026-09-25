import { strict as assert } from "node:assert";
import { test } from "node:test";

import { improntaDi } from "../archivio.ts";
import { sistema, type Bucket, type Dati } from "../manutenzione.ts";

const IO = "8e617a4c-7556-4750-8673-b08677de4f36";
const CONDO = "f0b9dfd6-8b20-460a-8b2c-86176f06caa9";
const ALTRO_CONDO = "cccccccc-0000-4000-8000-00000000000b";
const ADESSO = new Date("2026-09-25T12:00:00Z");
const IERI = "2026-09-24T10:00:00Z";
const ORA = "2026-09-25T11:00:00Z";

function mondo(file: Record<string, string>, righe: Record<string, string[]>, amministrati: string[]) {
  const oggetti = new Map(Object.entries(file));
  const citazioni = new Map(Object.entries(righe));
  const bucket: Bucket = {
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
      oggetti.set(a, oggetti.get(da)!);
      oggetti.delete(da);
      return { error: null };
    },
    async copy(da, a) {
      if (oggetti.has(a)) return { error: { message: "already exists" } };
      oggetti.set(a, oggetti.get(da)!);
      return { error: null };
    },
    async remove(paths) {
      for (const p of paths) oggetti.delete(p);
      return { error: null };
    },
  };
  const dati: Dati = {
    async condominiCheCitano(path) {
      return citazioni.get(path) ?? [];
    },
    async condominiAmministrati() {
      return amministrati;
    },
    async sostituisci(da, a) {
      const c = citazioni.get(da);
      if (c) {
        citazioni.set(a, [...(citazioni.get(a) ?? []), ...c]);
        citazioni.delete(da);
      }
    },
  };
  return { bucket, dati, oggetti, citazioni };
}

const archivio = (contenuto: string, nome: string) =>
  `${CONDO}/documenti/${improntaDi(new TextEncoder().encode(contenuto)).slice(0, 16)}-${nome}`;

test("lo storico citato dai dati passa al condominio, e le righe con lui", async () => {
  const vecchio = `documenti/${IO}/ccf98764-4cd7-4cf1-b5f6-94350b99f9a2-Rendiconto 2023-2024.pdf`;
  const m = mondo({ [vecchio]: "pdf 2023" }, { [vecchio]: [CONDO] }, [CONDO]);
  const esito = await sistema(m.bucket, m.dati, { path: vecchio, creato: IERI }, ADESSO);
  const nuovo = archivio("pdf 2023", "Rendiconto 2023-2024.pdf");
  assert.deepEqual(esito, { azione: "spostato", a: nuovo });
  assert.deepEqual([...m.oggetti.keys()], [nuovo]);
  assert.deepEqual(m.citazioni.get(nuovo), [CONDO]);
  assert.equal(m.citazioni.has(vecchio), false);
});

test("due copie storiche dello stesso contenuto diventano un file solo", async () => {
  const a = `documenti/${IO}/56041f52-cb9d-4d11-8c14-6cea00dbecc3-R.pdf`;
  const b = `documenti/${IO}/5645cf8f-efe3-4e47-bcfb-d055d02b1c32-R (2).pdf`;
  const m = mondo({ [a]: "stesso", [b]: "stesso" }, { [b]: [CONDO] }, [CONDO]);
  await sistema(m.bucket, m.dati, { path: a, creato: IERI }, ADESSO);
  const esito = await sistema(m.bucket, m.dati, { path: b, creato: IERI }, ADESSO);
  assert.deepEqual(esito, { azione: "spostato", a: archivio("stesso", "R.pdf") });
  assert.equal(m.oggetti.size, 1);
  assert.deepEqual(m.citazioni.get(archivio("stesso", "R.pdf")), [CONDO]);
});

test("lo storico che nessuno cita va al condominio di chi lo caricò, se è uno solo", async () => {
  const vecchio = `documenti/${IO}/701e7b2b-3772-431d-bf57-11cff0f6176e-ENRIQUES 3.pdf`;
  const uno = mondo({ [vecchio]: "x" }, {}, [CONDO]);
  assert.equal((await sistema(uno.bucket, uno.dati, { path: vecchio, creato: IERI }, ADESSO)).azione, "spostato");

  const due = mondo({ [vecchio]: "x" }, {}, [CONDO, ALTRO_CONDO]);
  assert.deepEqual(await sistema(due.bucket, due.dati, { path: vecchio, creato: IERI }, ADESSO), {
    azione: "lasciato",
    motivo: "non si sa di quale condominio sia",
  });
  assert.ok(due.oggetti.has(vecchio));
});

test("un caricamento mai salvato che è un doppione dell'archivio si cancella", async () => {
  const caricato = `pending/${IO}/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3.pdf`;
  const inArchivio = archivio("pdf", "ENRIQUES 3.pdf");
  const m = mondo({ [caricato]: "pdf", [inArchivio]: "pdf" }, {}, [CONDO]);
  assert.deepEqual(await sistema(m.bucket, m.dati, { path: caricato, creato: IERI }, ADESSO), {
    azione: "doppione rimosso",
    uguale_a: inArchivio,
  });
  assert.deepEqual([...m.oggetti.keys()], [inArchivio]);
});

test("un caricamento con contenuto unico non si cancella mai", async () => {
  const caricato = `pending/${IO}/2ceb50f3-6111-4c81-ba2f-7b36454573e2-ENRIQUES 3-2.pdf`;
  const m = mondo({ [caricato]: "unico" }, {}, [CONDO]);
  assert.equal((await sistema(m.bucket, m.dati, { path: caricato, creato: IERI }, ADESSO)).azione, "lasciato");
  assert.ok(m.oggetti.has(caricato));
});

test("un caricamento di poco fa può essere un'analisi in corso: non si tocca", async () => {
  const caricato = `pending/${IO}/2ceb50f3-6111-4c81-ba2f-7b36454573e2-R.pdf`;
  const m = mondo({ [caricato]: "pdf", [archivio("pdf", "R.pdf")]: "pdf" }, {}, [CONDO]);
  assert.deepEqual(await sistema(m.bucket, m.dati, { path: caricato, creato: ORA }, ADESSO), {
    azione: "lasciato",
    motivo: "caricato da poco",
  });
  assert.equal(m.oggetti.size, 2);
});

test("un caricamento che i dati citano entra nell'archivio anche se è recente", async () => {
  const caricato = `pending/${IO}/2ceb50f3-6111-4c81-ba2f-7b36454573e2-R.pdf`;
  const m = mondo({ [caricato]: "pdf" }, { [caricato]: [CONDO] }, [CONDO]);
  assert.equal((await sistema(m.bucket, m.dati, { path: caricato, creato: ORA }, ADESSO)).azione, "spostato");
});

test("un file già nella cartella del condominio resta dov'è", async () => {
  const p = archivio("pdf", "R.pdf");
  const m = mondo({ [p]: "pdf" }, {}, [CONDO]);
  assert.equal((await sistema(m.bucket, m.dati, { path: p, creato: IERI }, ADESSO)).azione, "lasciato");
  assert.ok(m.oggetti.has(p));
});
