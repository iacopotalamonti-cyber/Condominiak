import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // I sorgenti non vengono caricati su Sentry: gli errori lato server restano
  // leggibili lo stesso, quelli del browser arrivano minificati. Per averli
  // leggibili basta aggiungere SENTRY_AUTH_TOKEN, org e project.
  sourcemaps: { disable: true },
});
