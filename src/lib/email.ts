// Le email che l'app manda da sé: oggi l'invito in un condominio.
//
// Passano da Resend, lo stesso servizio che Supabase usa per le email di
// accesso, con il dominio condominiak.me già verificato. La chiave sta nella
// variabile RESEND_API_KEY; senza, l'email non parte e chi invita riceve il
// link da mandare a mano, come prima.

const MITTENTE_PREDEFINITO = "Condominiak <noreply@condominiak.me>";

export interface Email {
  a: string;
  oggetto: string;
  html: string;
  testo: string;
}

export type EsitoEmail = { inviata: true } | { inviata: false; motivo: string };

export async function inviaEmail(email: Email): Promise<EsitoEmail> {
  const chiave = process.env.RESEND_API_KEY;
  if (!chiave) return { inviata: false, motivo: "invio email non configurato" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_MITTENTE || MITTENTE_PREDEFINITO,
        to: [email.a],
        subject: email.oggetto,
        html: email.html,
        text: email.testo,
      }),
    });
    if (!res.ok) {
      const dettaglio = await res.text().catch(() => "");
      console.error(`Email a ${email.a} non inviata (${res.status}):`, dettaglio.slice(0, 300));
      return { inviata: false, motivo: `il servizio email ha risposto ${res.status}` };
    }
    return { inviata: true };
  } catch (error) {
    console.error(`Email a ${email.a} non inviata:`, error);
    return { inviata: false, motivo: "servizio email non raggiungibile" };
  }
}

// Il nome del condominio e di chi invita li scrive un utente: nell'HTML vanno
// resi innocui, o un indirizzo come "<a href=…>" diventerebbe un link vero.
export function escape(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailInvito(dati: {
  a: string;
  condominio: string;
  link: string;
  chiInvita: string;
  gestore: boolean;
  giorni: number;
}): Email {
  const ruolo = dati.gestore
    ? "per gestirlo insieme a chi lo amministra"
    : "per vedere i conti del condominio e la quota del tuo appartamento";
  const oggetto = `Invito al condominio di ${dati.condominio} su Condominiak`;
  const testo = [
    `${dati.chiInvita} ti ha invitato nel condominio di ${dati.condominio} su Condominiak, ${ruolo}.`,
    "",
    `Per accettare apri questo link: ${dati.link}`,
    "",
    `Il link vale ${dati.giorni} giorni e solo per questo indirizzo (${dati.a}). Se non aspettavi questo invito, ignora l'email.`,
    "",
    "Condominiak",
  ].join("\n");
  const html = `<h2>Sei stato invitato su Condominiak</h2>
<p>${escape(dati.chiInvita)} ti ha invitato nel condominio di <strong>${escape(dati.condominio)}</strong>, ${escape(ruolo)}.</p>
<p><a href="${escape(dati.link)}">Accetta l'invito</a></p>
<p>Il link vale ${dati.giorni} giorni e solo per questo indirizzo (${escape(dati.a)}). Se non aspettavi questo invito, ignora l'email.</p>
<p>Condominiak</p>`;
  return { a: dati.a, oggetto, html, testo };
}
