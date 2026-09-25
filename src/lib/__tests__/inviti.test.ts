import { strict as assert } from "node:assert";
import { test } from "node:test";

import { impronta, motivoDiRifiuto, nuovoToken, scadenza } from "../inviti.ts";

const ADESSO = new Date("2026-09-25T10:00:00Z");
const VALIDO = { email: "Rossi@Esempio.it", scade_il: "2026-10-09T10:00:00Z", usato_il: null };

test("un token non si ripete e l'impronta non lo rivela", () => {
  const a = nuovoToken();
  const b = nuovoToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 43, "32 byte in base64url");
  assert.match(a, /^[A-Za-z0-9_-]+$/, "si può mettere in un link");
  assert.equal(impronta(a), impronta(a));
  assert.notEqual(impronta(a), a);
  assert.match(impronta(a), /^[0-9a-f]{64}$/);
});

test("un invito vale quattordici giorni", () => {
  assert.equal(scadenza(ADESSO).toISOString(), "2026-10-09T10:00:00.000Z");
});

test("l'invito valido si accetta con l'email invitata, maiuscole a parte", () => {
  assert.equal(motivoDiRifiuto(VALIDO, "rossi@esempio.it ", ADESSO), null);
});

test("un link inoltrato non fa entrare chi lo riceve", () => {
  assert.match(motivoDiRifiuto(VALIDO, "altro@esempio.it", ADESSO) ?? "", /è per Rossi@Esempio.it/);
  assert.match(motivoDiRifiuto(VALIDO, undefined, ADESSO) ?? "", /è per/);
});

test("un invito usato, scaduto o inesistente non vale", () => {
  assert.match(motivoDiRifiuto({ ...VALIDO, usato_il: "2026-09-20T00:00:00Z" }, "rossi@esempio.it", ADESSO) ?? "", /già stato usato/);
  assert.match(motivoDiRifiuto({ ...VALIDO, scade_il: "2026-09-25T10:00:00Z" }, "rossi@esempio.it", ADESSO) ?? "", /scaduto/);
  assert.match(motivoDiRifiuto(null, "rossi@esempio.it", ADESSO) ?? "", /non esiste/);
});
