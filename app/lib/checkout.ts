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
}

export interface Order {
  id: string;
  customerId: string;
  status: string;
  totalCents: number;
  items: OrderItem[];
}

export type PaymentMethod = "credit_card" | "bypass" | "dev_simulate";

export interface PaymentSettings {
  devSimulate: boolean;
  methodBypass: boolean;
  methodCreditCard: boolean;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const res = await fetch("/api/v1/payments/settings");
  if (!res.ok) return { devSimulate: false, methodBypass: false, methodCreditCard: true };
  const body = (await res.json()) as {
    features?: { dev_simulate_success?: boolean; method_bypass?: boolean; method_credit_card?: boolean };
  };
  return {
    devSimulate: body.features?.dev_simulate_success ?? false,
    methodBypass: body.features?.method_bypass ?? false,
    methodCreditCard: body.features?.method_credit_card ?? true,
  };
}

export interface Payment {
  id: string;
  orderId: string;
  amountCents: number;
  status: string;
  method: PaymentMethod | string;
  /** Present for credit_card local/dev simulate. Omitted for bypass. */
  checkoutUrl?: string;
}

interface RawSession {
  id: string;
  status: "open" | "completed" | "expired";
  subtotal_cents?: number;
  discount_cents?: number;
  total_cents?: number;
  coupon_code?: string;
  order_id?: string;
}

interface RawOrderItem {
  sku: string;
  sku_id?: string;
  quantity: number;
  unit_price_cents: number;
}

interface RawOrder {
  id: string;
  customer_id: string;
  status: string;
  total_cents?: number;
  items?: RawOrderItem[] | null;
}

function mapSession(raw: RawSession): CheckoutSession {
  return {
    id: raw.id,
    status: raw.status,
    subtotalCents: raw.subtotal_cents ?? 0,
    discountCents: raw.discount_cents ?? 0,
    totalCents: raw.total_cents ?? 0,
    couponCode: raw.coupon_code,
    orderId: raw.order_id,
  };
}

function mapOrder(raw: RawOrder): Order {
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
    })),
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

export function isValidKRPhone(phone: string): boolean {
  return /^01[0-9]{8,9}$/.test(normalizeKRPhoneDigits(phone));
}

export function normalizePostalCode(zip: string): string {
  return zip.replace(/\D/g, "");
}

export function isValidKRPostalCode(zip: string): boolean {
  return /^\d{5}$/.test(normalizePostalCode(zip));
}

export function buildCheckoutFulfillment(input: {
  name: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  zip: string;
  province: string;
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
  // dev_simulate is a frontend-only concept; send credit_card to the backend.
  const wireMethod: "credit_card" | "bypass" =
    method === "dev_simulate" ? "credit_card" : method;
  const body: { order_id: string; method: "credit_card" | "bypass"; note?: string } = {
    order_id: orderId,
    method: wireMethod,
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

/** Dev-only: marks a payment as succeeded (PAYMENT_ALLOW_DEV_SIMULATE). */
export async function simulatePaymentSuccess(paymentId: string): Promise<void> {
  await request(`/api/v1/payments/${encodeURIComponent(paymentId)}/simulate-success`);
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await request(`/api/v1/orders/${encodeURIComponent(orderId)}`);
  return mapOrder(await res.json());
}
