// Tracciamento degli errori lato server (route API, rendering, middleware).
//
// Next chiama register() una volta sola all'avvio di ogni istanza del server,
// e onRequestError ogni volta che cattura un errore di richiesta.
// Vedi node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md

import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  // Senza DSN l'applicazione gira identica, semplicemente senza tracciamento:
  // in locale è il comportamento che si vuole.
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Su Netlify CONTEXT vale "production", "deploy-preview" o "branch-deploy":
    // basta a non confondere gli errori dello staging con quelli veri.
    environment: process.env.CONTEXT ?? "development",
    // Solo errori, niente tracciamento delle prestazioni: il piano gratuito
    // finirebbe in un giorno e non è quello che ci serve sapere.
    tracesSampleRate: 0,
    // Gli errori di questa applicazione passano accanto a nomi, email e importi
    // dei condòmini. Niente dati personali raccolti in automatico.
    sendDefaultPii: false,
  });
}

export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
