import { strict as assert } from "node:assert";
import { test } from "node:test";

import { emailInvito, escape } from "../email.ts";

const BASE = {
  a: "rossi@esempio.it",
  condominio: "Via Enriques, 3, Bologna",
  link: "https://www.condominiak.me/invite/abc",
  chiInvita: "amministratore@esempio.it",
  gestore: false,
  giorni: 14,
};

test("l'email d'invito porta il link, il condominio e la scadenza", () => {
  const email = emailInvito(BASE);
  assert.equal(email.a, "rossi@esempio.it");
  assert.match(email.oggetto, /Via Enriques, 3, Bologna/);
  assert.match(email.html, /href="https:\/\/www\.condominiak\.me\/invite\/abc"/);
  assert.match(email.testo, /https:\/\/www\.condominiak\.me\/invite\/abc/);
  assert.match(email.testo, /14 giorni/);
  assert.match(email.testo, /quota del tuo appartamento/);
  assert.match(emailInvito({ ...BASE, gestore: true }).testo, /per gestirlo/);
});

test("quello che scrive un utente non diventa HTML", () => {
  const email = emailInvito({ ...BASE, condominio: '<a href="x">Via</a>' });
  assert.doesNotMatch(email.html, /<a href="x">/);
  assert.match(email.html, /&lt;a href=&quot;x&quot;&gt;Via&lt;\/a&gt;/);
  assert.equal(escape(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
});
