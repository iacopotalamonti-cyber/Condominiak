// Tracciamento degli errori nel browser.
//
// Questo file non esporta un register(): viene eseguito così com'è, prima che
// l'applicazione diventi interattiva.
// Vedi node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? "development",
    tracesSampleRate: 0,
    // Nessuna registrazione della sessione: filmare lo schermo di un condòmino
    // mentre legge il proprio rendiconto è esattamente ciò che non vogliamo.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
