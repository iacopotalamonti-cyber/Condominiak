// L'invito in un condominio.
//
// Era un link con l'id dell'unità: chi lo conosceva poteva tentare di
// rivendicarla, e il collegamento lo faceva il browser — dove la RLS lo
// bloccava in silenzio, così nessun invito ha mai collegato nessuno. Ora è un
// token casuale che si mostra una volta sola, di cui il database conserva solo
// l'impronta; scade, vale una volta, e vale soltanto per l'email invitata.

import { createHash, randomBytes } from "node:crypto";

export const GIORNI_VALIDITA = 14;

/** 32 byte casuali: non si indovina, e si può mettere in un link. */
export function nuovoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Quello che il database conserva: chi lo legge non può ricavarne il token. */
export function impronta(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function scadenza(da: Date = new Date()): Date {
  return new Date(da.getTime() + GIORNI_VALIDITA * 24 * 60 * 60 * 1000);
}

export function normalizzaEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface InvitoDaVerificare {
  email: string;
  scade_il: string;
  usato_il: string | null;
}

/**
 * Perché un invito non si può accettare, o null se si può.
 *
 * L'email deve essere quella invitata: un link inoltrato non fa entrare chi lo
 * riceve. Chi lo gestisce può invitare anche lui, con il suo indirizzo.
 */
export function motivoDiRifiuto(
  invito: InvitoDaVerificare | null,
  emailUtente: string | undefined,
  adesso: Date = new Date()
): string | null {
  if (!invito) return "Questo invito non esiste. Controlla di aver aperto il link intero.";
  if (invito.usato_il) return "Questo invito è già stato usato.";
  if (new Date(invito.scade_il).getTime() <= adesso.getTime()) {
    return "Questo invito è scaduto: chiedine un altro a chi gestisce il condominio.";
  }
  if (!emailUtente || normalizzaEmail(emailUtente) !== normalizzaEmail(invito.email)) {
    return `Questo invito è per ${invito.email}: entra con quell'indirizzo per accettarlo.`;
  }
  return null;
}
