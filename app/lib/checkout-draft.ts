// Persists the in-progress checkout form so a refresh, a closed tab, or a
// bounce off the NANO payment window does not make the shopper retype an
// address. Server state (the pending order) drives payment resume — see
// findResumableOrder in ./checkout; this only covers the form itself.
//
// localStorage rather than sessionStorage because reopening a *closed tab*
// must work. The draft holds PII (name, phone, address, PCCC), so it is
// scoped to one user id, expires with the server's checkout session TTL, and
// is dropped on every session change (see resetCheckoutDraft callers in
// ./auth).

const KEY = "dupli1_checkout_draft";

/** Matches dupli1 order DefaultCheckoutTTL (30 min). */
const TTL_MS = 30 * 60 * 1000;

const VERSION = 1;

export interface CheckoutDraft<TForm = unknown> {
  version: number;
  /** Never restore one shopper's address into another's session. */
  userId: string;
  expiresAt: number;
  activeStep: string;
  form: TForm;
  selectedAddressId: string | null;
  saveAddress: boolean;
  promoInput: string;
}

export type CheckoutDraftInput<TForm> = Omit<
  CheckoutDraft<TForm>,
  "version" | "expiresAt"
>;

export function saveCheckoutDraft<TForm>(draft: CheckoutDraftInput<TForm>): void {
  if (!draft.userId) return;
  try {
    const payload: CheckoutDraft<TForm> = {
      ...draft,
      version: VERSION,
      expiresAt: Date.now() + TTL_MS,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode, quota, or SSR — the draft is best-effort by design.
  }
}

/**
 * The stored draft, or null when there is none, it belongs to someone else,
 * it expired, or it was written by an older shape. Expired and mismatched
 * drafts are deleted on read so stale PII does not linger.
 */
export function loadCheckoutDraft<TForm>(userId: string): CheckoutDraft<TForm> | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft<TForm> | null;
    if (
      !parsed ||
      parsed.version !== VERSION ||
      parsed.userId !== userId ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now() ||
      !parsed.form
    ) {
      clearCheckoutDraft();
      return null;
    }
    return parsed;
  } catch {
    clearCheckoutDraft();
    return null;
  }
}

export function clearCheckoutDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op in SSR
  }
}
