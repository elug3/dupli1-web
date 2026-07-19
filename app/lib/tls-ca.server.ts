/**
 * Trust an optional PEM CA / self-signed gateway cert for BFF upstream fetch.
 *
 * Local Compose can expose the Dupli1 nginx gateway on HTTPS (:443) with the
 * self-signed material in elug3/dupli1 `certs/` (see scripts/dupli1-local-tls).
 * Set DUPLI1_API_CA_FILE to that certificate so Node's undici fetch accepts it
 * without disabling TLS verification globally.
 *
 * Production stays on plain HTTP to proxy.dupli1.local (TLS terminates at ALB).
 */
import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";

import { Agent, setGlobalDispatcher } from "undici";

declare global {
  var __dupli1ApiCaWired: boolean | undefined;
}

export function wireUpstreamTlsCa(): void {
  if (globalThis.__dupli1ApiCaWired) return;

  const caFile = process.env.DUPLI1_API_CA_FILE?.trim();
  if (!caFile) {
    globalThis.__dupli1ApiCaWired = true;
    return;
  }

  const customCa = readFileSync(caFile);
  setGlobalDispatcher(
    new Agent({
      connect: {
        ca: [...rootCertificates, customCa],
      },
    })
  );
  globalThis.__dupli1ApiCaWired = true;
}

wireUpstreamTlsCa();
