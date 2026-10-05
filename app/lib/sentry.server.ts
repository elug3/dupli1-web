import { sentryBrowserConfig } from "./sentry";

/** Browser Sentry config from this process's env; null when SENTRY_DSN is unset. */
export function loadSentryBrowserConfig() {
  return sentryBrowserConfig(process.env);
}
