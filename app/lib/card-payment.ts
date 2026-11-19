/**
 * Key-in card payment (NANO 수기결제, Linear SER-106).
 *
 * The shopper types the card on `/checkout/pay/:paymentId`; the route's SSR
 * action posts it to payment's `POST /api/v1/payments/{id}/card`, which sends
 * it to NANO once and never stores it. Nothing here keeps the card either: it
 * is read from the submitted form, forwarded, and dropped, and no response
 * this module builds ever contains it.
 *
 * Backend contract: dupli1 docs/payment-nano-key-in.md.
 */

/** Smallest amount Korean issuers split into installments (5만원). */
export const MIN_INSTALLMENT_WON = 50_000;
export const MAX_INSTALLMENT_MONTHS = 12;

/** Fields payment names when it refuses a typed card (`422 invalid_card`). */
export type CardField =
  | "card_number"
  | "exp_month"
  | "exp_year"
  | "card_password"
  | "holder_id"
  | "installment";

const CARD_FIELDS: readonly CardField[] = [
  "card_number",
  "exp_month",
  "exp_year",
  "card_password",
  "holder_id",
  "installment",
];

export interface CardPaymentRecord {
  id: string;
  orderId: string;
  amountWon: number;
  status: string;
  checkoutUrl?: string;
  /** NANO never answered an approval: the card may have been charged. */
  approvalUnconfirmed: boolean;
}

/** Reads payment's JSON for a payment, or null if it is not one. */
export function parsePaymentRecord(body: unknown): CardPaymentRecord | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.order_id !== "string")
    return null;
  return {
    id: raw.id,
    orderId: raw.order_id,
    amountWon: typeof raw.amount_won === "number" ? raw.amount_won : 0,
    status: typeof raw.status === "string" ? raw.status : "",
    checkoutUrl:
      typeof raw.checkout_url === "string" && raw.checkout_url
        ? raw.checkout_url
        : undefined,
    approvalUnconfirmed: raw.card_approval_unconfirmed === true,
  };
}

/** What `/checkout/pay/:id` shows (or does) for a payment. */
export type PayPageState =
  | { kind: "paid" }
  /** 인증결제 payment from before key-in: hand off to the NANO window bridge. */
  | { kind: "redirectWindow" }
  | { kind: "form" }
  | { kind: "unconfirmed" }
  | { kind: "closed" };

export function payPageState(payment: CardPaymentRecord): PayPageState {
  if (payment.status === "succeeded") return { kind: "paid" };
  if (payment.status !== "requires_payment") return { kind: "closed" };
  if (payment.approvalUnconfirmed) return { kind: "unconfirmed" };
  if (payment.checkoutUrl) return { kind: "redirectWindow" };
  return { kind: "form" };
}

export function confirmationPath(orderId: string, paymentId: string): string {
  const q = new URLSearchParams({ order_id: orderId, payment_id: paymentId });
  return `/checkout/confirmation?${q.toString()}`;
}

/** Installment choices for an amount: lump sum, then 2–12 months from ₩50,000. */
export function installmentOptions(amountWon: number): string[] {
  const options = ["00"];
  if (amountWon >= MIN_INSTALLMENT_WON) {
    for (let m = 2; m <= MAX_INSTALLMENT_MONTHS; m++) {
      options.push(String(m).padStart(2, "0"));
    }
  }
  return options;
}

export interface CardForm {
  card_number: string;
  exp_month: string;
  exp_year: string;
  card_password: string;
  holder_id: string;
  installment: string;
}

/**
 * The card fields from the submitted form, as payment expects them. Only
 * these keys are read, so nothing else in the form can reach payment.
 */
export function readCardForm(form: FormData): CardForm {
  const get = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    card_number: get("card_number").replace(/[\s-]/g, ""),
    exp_month: get("exp_month"),
    exp_year: get("exp_year"),
    card_password: get("card_password"),
    holder_id: get("holder_id").replace(/[\s-]/g, ""),
    installment: get("installment") || "00",
  };
}

/** Groups digits in fours as the shopper types (display only). */
export function formatCardNumberInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export type CardPayError =
  | { code: "invalid_card"; field: CardField }
  | { code: "declined"; message: string; attemptsRemaining: number }
  | { code: "attempts_exhausted" }
  | { code: "in_progress" }
  | { code: "unconfirmed" }
  | { code: "method_disabled"; message?: string }
  | { code: "order_closed" }
  | { code: "failed" };

export type CardPayOutcome =
  | { kind: "paid"; payment: CardPaymentRecord }
  | { kind: "error"; error: CardPayError };

/** Maps payment's answer to `POST …/card` onto what the page shows. */
export function interpretCardResponse(
  status: number,
  body: unknown,
): CardPayOutcome {
  const raw = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const reason = typeof raw.reason === "string" ? raw.reason : "";
  if (status >= 200 && status < 300) {
    const payment = parsePaymentRecord(body);
    if (payment?.status === "succeeded") return { kind: "paid", payment };
    return { kind: "error", error: { code: "failed" } };
  }
  switch (reason) {
    case "invalid_card": {
      const field = CARD_FIELDS.find((f) => f === raw.field) ?? "card_number";
      return { kind: "error", error: { code: "invalid_card", field } };
    }
    case "card_declined":
      return {
        kind: "error",
        error: {
          code: "declined",
          message:
            typeof raw.message === "string" ? raw.message.slice(0, 200) : "",
          attemptsRemaining:
            typeof raw.attempts_remaining === "number"
              ? raw.attempts_remaining
              : 0,
        },
      };
    case "card_attempts_exhausted":
      return { kind: "error", error: { code: "attempts_exhausted" } };
    case "card_approval_in_progress":
      return { kind: "error", error: { code: "in_progress" } };
    case "card_approval_unconfirmed":
      return { kind: "error", error: { code: "unconfirmed" } };
    case "payment_method_disabled":
      return {
        kind: "error",
        error: {
          code: "method_disabled",
          message: typeof raw.message === "string" ? raw.message : undefined,
        },
      };
  }
  // loadPendingOrder: the order auto-canceled (5 min unpaid) or was canceled.
  if (
    status === 400 &&
    typeof raw.error === "string" &&
    /not pending/i.test(raw.error)
  ) {
    return { kind: "error", error: { code: "order_closed" } };
  }
  return { kind: "error", error: { code: "failed" } };
}

/** i18n key for a field's label in an `invalid_card` error. */
export function cardFieldMessageKey(field: CardField): string {
  return `cardPay.invalid.${field}`;
}
