// Client for the real checkout flow: checkout sessions + orders live on
// dupli1-order, payments on dupli1-payment (both proxied through our BFF).
// See docs/checkout-session.md and docs/payment-service.md.
//
// Stock: on `complete`, order reserves via product-owned `/api/v1/inventory`
// (standalone inventory service removed). Payment does not touch stock;
// ship commits the reservation.

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  // Cookie session gateway attaches Bearer token; keeps calls off ALB `/api/*`.
  const res = await fetch(`/auth/session/gateway${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed: ${res.status}`;
  } catch {
    return `Request failed: ${res.status}`;
  }
}

/** True when order/checkout cannot resolve a sellable variant (hidden or removed). */
export function isUnpurchasableVariantError(message: string): boolean {
  return /variant\s+not\s+found/i.test(message.trim());
}

/** Legacy carts stored parent `product_id` as `sku` — not a sellable variant. */
export function isLegacyProductIdSku(
  sku: string | undefined,
  productId?: string
): boolean {
  const trimmedSku = sku?.trim();
  const trimmedProductId = productId?.trim();
  if (!trimmedSku || !trimmedProductId) return false;
  return trimmedSku.toUpperCase() === trimmedProductId.toUpperCase();
}

export interface CheckoutLineInput {
  sku?: string;
  skuId?: string;
  productId?: string;
  quantity: number;
}

/** Resolve sellable variant refs for checkout — prefer canonical sku_id over human sku. */
export function resolveCheckoutVariantRef(item: {
  sku?: string;
  skuId?: string;
  productId?: string;
}): { sku?: string; sku_id?: string } {
  const skuId = item.skuId?.trim();
  if (skuId) {
    const sku = item.sku?.trim().toUpperCase();
    return {
      sku_id: skuId,
      ...(sku && !isLegacyProductIdSku(sku, item.productId) ? { sku } : {}),
    };
  }

  const sku = item.sku?.trim().toUpperCase();
  if (!sku || isLegacyProductIdSku(sku, item.productId)) return {};
  return { sku };
}

export function isCheckoutLineUnpurchasable(item: {
  sku?: string;
  skuId?: string;
  productId?: string;
}): boolean {
  const ref = resolveCheckoutVariantRef(item);
  return !ref.sku && !ref.sku_id;
}

export function cartHasUnpurchasableItems(
  items: Array<{ sku?: string; skuId?: string; productId?: string }>
): boolean {
  return items.some(isCheckoutLineUnpurchasable);
}

export function getUnpurchasableCartItems<
  T extends { sku?: string; skuId?: string; productId?: string },
>(items: T[]): T[] {
  return items.filter(isCheckoutLineUnpurchasable);
}

export function buildCheckoutSessionItem(item: CheckoutLineInput): SessionItem {
  return {
    ...resolveCheckoutVariantRef(item),
    quantity: item.quantity,
  };
}

export interface SessionItem {
  /** Human variant SKU when known; omit when only sku_id is available. */
  sku?: string;
  /** Canonical variant id when known (order stores as sku_id). */
  sku_id?: string;
  quantity: number;
}

export interface CheckoutSession {
  id: string;
  status: "open" | "completed" | "expired";
  subtotalCents: number;
  discountCents: number;
  /**
   * Delivery charge the order service quoted for this session, in whole KRW.
   * Authoritative: it is what the backend will actually charge, and it is fixed
   * when the session opens. Prefer it over the SHIPPING_FEE constant, which is
   * only a pre-session display fallback.
   */
  shippingFeeCents: number;
  totalCents: number;
  couponCode?: string;
  orderId?: string;
}

export interface OrderItem {
  sku: string;
  skuId?: string;
  quantity: number;
  /** Whole KRW won (JSON `unit_price_cents`). */
  unitPriceCents: number;
  productName?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  customerId: string;
  status: string;
  totalCents: number;
  items: OrderItem[];
  /** Epoch ms the unpaid window closes; order auto-cancels after it (5 min). */
  paymentDueAtMs?: number;
  paymentId?: string;
}

/** Dev simulate was removed upstream and merged into bypass (payment-service.md). */
export type PaymentMethod = "credit_card" | "bypass";

export interface PaymentSettings {
  methodBypass: boolean;
  methodCreditCard: boolean;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  // Deliberately NOT the session gateway: `/payments/settings` takes no auth
  // (dupli1 docs/endpoints.md), so the browser hits it like the public catalog
  // and the production ALB forwards `/api/*` to dupli1-proxy.
  const res = await fetch("/api/v1/payments/settings");
  if (!res.ok) return { methodBypass: false, methodCreditCard: true };
  const body = (await res.json()) as {
    features?: { method_bypass?: boolean; method_credit_card?: boolean };
  };
  return {
    methodBypass: body.features?.method_bypass ?? false,
    methodCreditCard: body.features?.method_credit_card ?? true,
  };
}

/**
 * Fetches the delivery charge the order service will actually apply, in whole
 * KRW. Same public, unauthenticated settings route as getPaymentSettings.
 *
 * Returns null when the service cannot be reached or does not publish the
 * field, so callers fall back to the SHIPPING_FEE display constant rather than
 * silently quoting 0.
 */
export async function getShippingFeeCents(): Promise<number | null> {
  try {
    const res = await fetch("/api/v1/orders/settings");
    if (!res.ok) return null;
    const body = (await res.json()) as {
      limits?: { shipping_fee_cents?: number };
    };
    const fee = body.limits?.shipping_fee_cents;
    return typeof fee === "number" && fee >= 0 ? fee : null;
  } catch {
    return null;
  }
}

export interface Payment {
  id: string;
  orderId: string;
  amountCents: number;
  status: string;
  method: PaymentMethod | string;
  /** Present for credit_card (NANO checkout bridge). Omitted for bypass. */
  checkoutUrl?: string;
}

interface RawSession {
  id: string;
  status: "open" | "completed" | "expired";
  subtotal_cents?: number;
  discount_cents?: number;
  shipping_fee_cents?: number;
  total_cents?: number;
  coupon_code?: string;
  order_id?: string;
}

interface RawOrderItem {
  sku: string;
  sku_id?: string;
  quantity: number;
  unit_price_cents: number;
  product_name?: string;
  image_url?: string;
}

interface RawOrder {
  id: string;
  customer_id: string;
  status: string;
  total_cents?: number;
  items?: RawOrderItem[] | null;
  payment_due_at?: string;
  payment_id?: string;
}

function mapSession(raw: RawSession): CheckoutSession {
  return {
    id: raw.id,
    status: raw.status,
    subtotalCents: raw.subtotal_cents ?? 0,
    discountCents: raw.discount_cents ?? 0,
    // Older order services omit the field; 0 (free delivery) is the safe read.
    shippingFeeCents: raw.shipping_fee_cents ?? 0,
    totalCents: raw.total_cents ?? 0,
    couponCode: raw.coupon_code,
    orderId: raw.order_id,
  };
}

function mapOrder(raw: RawOrder): Order {
  const dueAt = raw.payment_due_at ? Date.parse(raw.payment_due_at) : NaN;
  return {
    id: raw.id,
    customerId: raw.customer_id,
    status: raw.status,
    totalCents: raw.total_cents ?? 0,
    items: (raw.items ?? []).map((item) => ({
      sku: item.sku,
      skuId: item.sku_id || undefined,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      productName: item.product_name || undefined,
      imageUrl: item.image_url || undefined,
    })),
    paymentDueAtMs: Number.isNaN(dueAt) ? undefined : dueAt,
    paymentId: raw.payment_id || undefined,
  };
}

export async function createCheckoutSession(customerId: string): Promise<CheckoutSession> {
  const res = await request("/api/v1/checkout/sessions", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId }),
  });
  return mapSession(await res.json());
}

export async function replaceSessionItems(
  sessionId: string,
  items: SessionItem[]
): Promise<CheckoutSession> {
  const res = await request(
    `/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/items`,
    { method: "PUT", body: JSON.stringify({ items }) }
  );
  return mapSession(await res.json());
}

export async function applySessionCoupon(sessionId: string, code: string): Promise<CheckoutSession> {
  const res = await request(
    `/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/coupon`,
    { method: "POST", body: JSON.stringify({ code }) }
  );
  return mapSession(await res.json());
}

export interface CheckoutShippingAddress {
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  /**
   * Korea Personal Customs Clearance Code ("P" + 12 digits). Required by the
   * checkout UI to clear shipments through customs; kept optional in this
   * wire type since the backend (elug3/dupli1#200) still accepts a blank
   * value for backward compatibility with addresses saved before this was enforced.
   */
  pccc?: string;
}

/** Fulfillment snapshot required by order service since checkout phase B. */
export interface CheckoutFulfillment {
  recipientName: string;
  recipientPhone: string;
  shippingAddress: CheckoutShippingAddress;
  /** Optional audit id when copied from auth profile saved address. */
  addressId?: string;
}

function mapFulfillmentBody(fulfillment: CheckoutFulfillment): Record<string, unknown> {
  const body: Record<string, unknown> = {
    recipient_name: fulfillment.recipientName,
    recipient_phone: fulfillment.recipientPhone,
    shipping_address: {
      postal_code: fulfillment.shippingAddress.postalCode,
      address_line1: fulfillment.shippingAddress.addressLine1,
      city: fulfillment.shippingAddress.city,
      province: fulfillment.shippingAddress.province,
    },
  };
  const line2 = fulfillment.shippingAddress.addressLine2?.trim();
  if (line2) {
    (body.shipping_address as Record<string, string>).address_line2 = line2;
  }
  const pccc = fulfillment.shippingAddress.pccc?.trim();
  if (pccc) {
    (body.shipping_address as Record<string, string>).pccc = normalizePCCC(pccc);
  }
  const addressId = fulfillment.addressId?.trim();
  if (addressId) {
    body.address_id = addressId;
  }
  return body;
}

/** Strip non-digits from a Korean phone input (matches order service normalization). */
export function normalizeKRPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** 10 or 11 digits total, starting "01" (mobile prefix) — matches order/auth service validation. */
export function isValidKRPhone(phone: string): boolean {
  return /^01[0-9]{8,9}$/.test(normalizeKRPhoneDigits(phone));
}

/**
 * Auto-hyphenate a Korean phone number as the user types: 3-3-4 while under
 * 11 digits (010-123-4567), 3-4-4 once the 11th digit lands (010-1234-5678).
 * Extra digits beyond 11 are dropped.
 */
export function formatKRPhoneInput(raw: string): string {
  const digits = normalizeKRPhoneDigits(raw).slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** Digits only, capped at 5 — Korean postal codes are always exactly 5 digits. */
export function normalizePostalCode(zip: string): string {
  return zip.replace(/\D/g, "").slice(0, 5);
}

export function isValidKRPostalCode(zip: string): boolean {
  return /^\d{5}$/.test(normalizePostalCode(zip));
}

const pcccRE = /^P\d{12}$/;

/** Trim and uppercase a Personal Customs Clearance Code (matches auth/order normalization). */
export function normalizePCCC(code: string): string {
  return code.trim().toUpperCase();
}

/** PCCC ("P" + 12 digits) used by carriers to clear overseas-purchase shipments through Korean customs. */
export function isValidPCCC(code: string): boolean {
  return pcccRE.test(normalizePCCC(code));
}

export function buildCheckoutFulfillment(input: {
  name: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  zip: string;
  province: string;
  pccc?: string;
  addressId?: string;
}): CheckoutFulfillment {
  return {
    recipientName: input.name.trim(),
    recipientPhone: normalizeKRPhoneDigits(input.phone),
    shippingAddress: {
      postalCode: normalizePostalCode(input.zip),
      addressLine1: input.address.trim(),
      addressLine2: input.apartment.trim() || undefined,
      city: input.city.trim(),
      province: input.province.trim(),
      pccc: input.pccc?.trim() || undefined,
    },
    addressId: input.addressId?.trim() || undefined,
  };
}

export async function completeCheckoutSession(
  sessionId: string,
  fulfillment: CheckoutFulfillment
): Promise<{ session: CheckoutSession; order: Order }> {
  const res = await request(
    `/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST", body: JSON.stringify(mapFulfillmentBody(fulfillment)) }
  );
  const body = (await res.json()) as { session: RawSession; order: RawOrder };
  return { session: mapSession(body.session), order: mapOrder(body.order) };
}

export async function createPayment(
  orderId: string,
  method: PaymentMethod = "credit_card",
  options: { note?: string } = {}
): Promise<Payment> {
  const body: { order_id: string; method: PaymentMethod; note?: string } = {
    order_id: orderId,
    method,
  };
  if (method === "bypass" && options.note?.trim()) {
    body.note = options.note.trim();
  }
  const res = await request("/api/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = (await res.json()) as {
    id: string;
    order_id: string;
    amount_cents: number;
    status: string;
    method?: string;
    checkout_url?: string;
  };
  return {
    id: raw.id,
    orderId: raw.order_id,
    amountCents: raw.amount_cents,
    status: raw.status,
    method: raw.method ?? method,
    checkoutUrl: raw.checkout_url || undefined,
  };
}

/**
 * Reads a payment's current state. Used after a PG return to tell a decline
 * (`failed`) apart from an approval the backend could not verify, which leaves
 * the payment `requires_payment` even though the card may already be charged.
 */
export async function getPayment(paymentId: string): Promise<Payment> {
  const res = await request(`/api/v1/payments/${encodeURIComponent(paymentId)}`);
  const raw = (await res.json()) as {
    id: string;
    order_id: string;
    amount_cents: number;
    status: string;
    method?: string;
    checkout_url?: string;
  };
  return {
    id: raw.id,
    orderId: raw.order_id,
    amountCents: raw.amount_cents,
    status: raw.status,
    method: raw.method ?? "credit_card",
    checkoutUrl: raw.checkout_url || undefined,
  };
}

/**
 * How a PG return should be treated.
 *
 * `declined` — the shopper can safely try again.
 * `unconfirmed` — the PG approved but the backend rejected the callback, so
 *   money may already be gone. Never invite a retry here (elug3/dupli1#232).
 */
export type PaymentReturnKind = "declined" | "unconfirmed";

/** Reasons dupli1 attaches to the failure redirect for an unverifiable approval. */
const UNCONFIRMED_REASONS = new Set([
  "verify_failed",
  "verification_failed",
  "invalid_payment",
  "amount_mismatch",
]);

/**
 * Classifies a `?error=` reason on the PG failure redirect.
 *
 * dupli1 attaches a reason on every failure path (payment nanoReturnReason), so
 * an absent or unrecognised one means we cannot show a charge was approved —
 * treat it as an ordinary decline rather than alarming the shopper.
 */
export function classifyPaymentReturn(reason: string | null | undefined): PaymentReturnKind {
  const value = reason?.trim().toLowerCase();
  if (!value) return "declined";
  return UNCONFIRMED_REASONS.has(value) ? "unconfirmed" : "declined";
}

/**
 * A payment the PG sent back as failed but that never reached a terminal state
 * is the dangerous case: approved upstream, unverified here.
 */
export function isUnconfirmedPayment(payment: Payment): boolean {
  return payment.status === "requires_payment";
}

/**
 * How the unconfirmed-payment notice should identify the attempt to the shopper.
 *
 * `order` is what support wants quoted; `payment` is the fallback when the PG
 * return could not be tied to an order at all.
 */
export type PaymentReference =
  | { kind: "order"; value: string }
  | { kind: "payment"; value: string }
  | null;

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Picks the reference the unconfirmed-payment warning should quote.
 *
 * dupli1 omits `order_id` from the failure redirect whenever it could not tie
 * the callback to a payment row — `unknown_payment`, `shop_mismatch` and
 * `lookup_failed` all reject with a nil payment (payment/pkg/service/nano_callback.go),
 * and `appendNanoReturnQuery` drops empty values rather than blanking them.
 * That is precisely when a charge is most likely to be stranded, so the warning
 * must never be conditional on having an order id: fall through to the order we
 * independently found, then to the payment id, and show the notice with no
 * reference at all rather than staying silent.
 */
export function resolvePaymentReference(input: {
  returnedOrderId?: string;
  resumableOrderId?: string;
  returnedPaymentId?: string;
}): PaymentReference {
  const orderId = firstNonEmpty(input.returnedOrderId, input.resumableOrderId);
  if (orderId) return { kind: "order", value: orderId };
  const paymentId = firstNonEmpty(input.returnedPaymentId);
  if (paymentId) return { kind: "payment", value: paymentId };
  return null;
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await request(`/api/v1/orders/${encodeURIComponent(orderId)}`);
  return mapOrder(await res.json());
}

export async function listMyOrders(customerId: string): Promise<Order[]> {
  const res = await request(`/api/v1/orders?customer_id=${encodeURIComponent(customerId)}`);
  const body = (await res.json()) as { orders?: RawOrder[] | null };
  return (body.orders ?? []).map(mapOrder);
}

/** True while an order can still be paid: pending and inside its unpaid window. */
export function isResumableOrder(order: Order, nowMs: number = Date.now()): boolean {
  if (order.status !== "pending") return false;
  // No payment_due_at means the server did not scope the window; treat the
  // pending status as authoritative rather than hiding a payable order.
  if (order.paymentDueAtMs === undefined) return true;
  return order.paymentDueAtMs > nowMs;
}

/** Whether placing a brand-new order must be blocked to avoid double charges. */
export function blocksNewCheckoutOrder(opts: {
  paymentUnconfirmed: boolean;
  resumeOrder: Order | null;
  nowMs?: number;
}): boolean {
  if (opts.paymentUnconfirmed) return true;
  return opts.resumeOrder !== null && isResumableOrder(opts.resumeOrder, opts.nowMs);
}

/**
 * The order a returning shopper should be offered a chance to pay.
 *
 * Server-side truth, so it survives a refresh, a closed tab, cleared storage,
 * and even a different device — unlike anything cached in the browser. The
 * unpaid window is 5 minutes (dupli1 order DefaultPaymentTTL); past it the
 * order is canceled and stock released, so nothing is resumable.
 */
export async function findResumableOrder(
  customerId: string,
  nowMs: number = Date.now()
): Promise<Order | null> {
  const orders = await listMyOrders(customerId);
  const resumable = orders.filter((order) => isResumableOrder(order, nowMs));
  if (resumable.length === 0) return null;
  // Latest deadline == most recently created, without needing created_at.
  return resumable.reduce((newest, order) =>
    (order.paymentDueAtMs ?? 0) > (newest.paymentDueAtMs ?? 0) ? order : newest
  );
}
