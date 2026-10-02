import { isbot } from "isbot";

/**
 * Unique-visitor beacon (elug3/dupli1 `POST /api/v1/products/visits`).
 *
 * product reads the `dupli1_guest` cookie — minting it when absent, the same
 * one unique product views use — and counts the browser once per KST day for
 * the admin visitors report. Under `/api/v1` so production sends it straight
 * to the gateway; the local-dev mirror is `routes/api/v1/products/visits.ts`.
 */
export const VISIT_BEACON_PATH = "/api/v1/products/visits";

/** Remembers the KST day already reported, so later page loads skip the call. */
export const VISIT_STORAGE_KEY = "dupli1_visit_day";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** The KST calendar day of `now`, `YYYY-MM-DD` — the backend's visit day. */
export function kstDay(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

interface VisitDeps {
  fetch: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem">;
  userAgent: string;
  now: Date;
}

/**
 * Reports this browser as today's visitor at most once per KST day. Never
 * throws: counting a visit must not affect the page.
 */
export async function recordVisit(deps: VisitDeps): Promise<void> {
  if (!deps.userAgent || isbot(deps.userAgent)) return;

  const day = kstDay(deps.now);
  try {
    if (deps.storage?.getItem(VISIT_STORAGE_KEY) === day) return;
  } catch {
    // Storage blocked (private mode, disabled site data): just send.
  }

  try {
    const response = await deps.fetch(VISIT_BEACON_PATH, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    });
    if (!response.ok) return;
    deps.storage?.setItem(VISIT_STORAGE_KEY, day);
  } catch {
    // Offline or blocked: try again on the next page load.
  }
}

/** Browser entry point, called once per page load from the root layout. */
export function recordBrowserVisit(): void {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  void recordVisit({
    fetch: window.fetch.bind(window),
    storage,
    userAgent: navigator.userAgent,
    now: new Date(),
  });
}
