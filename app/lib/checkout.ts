// Client for the real checkout flow: checkout sessions + orders live on
// dupli1-order, payments on dupli1-payment (both proxied through our BFF).
// See docs/checkout-session.md and docs/payment-service.md.

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, credentials: "same-origin", headers });
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

export interface SessionItem {
  sku: string;
  quantity: number;
  unit_price_cents: number;
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
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: string;
  totalCents: number;
  items: OrderItem[];
}

export interface Payment {
  id: string;
  orderId: string;
  amountCents: number;
  status: string;
  checkoutUrl: string;
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

export async function completeCheckoutSession(
  sessionId: string
): Promise<{ session: CheckoutSession; order: Order }> {
  const res = await request(
    `/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST" }
  );
  const body = (await res.json()) as { session: RawSession; order: RawOrder };
  return { session: mapSession(body.session), order: mapOrder(body.order) };
}

export async function createPayment(orderId: string): Promise<Payment> {
  const res = await request("/api/v1/payments", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });
  const body = (await res.json()) as {
    id: string;
    order_id: string;
    amount_cents: number;
    status: string;
    checkout_url: string;
  };
  return {
    id: body.id,
    orderId: body.order_id,
    amountCents: body.amount_cents,
    status: body.status,
    checkoutUrl: body.checkout_url,
  };
}

/** Dev-only: marks a payment as succeeded when Stripe isn't configured. */
export async function simulatePaymentSuccess(paymentId: string): Promise<void> {
  await request(`/api/v1/payments/${encodeURIComponent(paymentId)}/simulate-success`);
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await request(`/api/v1/orders/${encodeURIComponent(orderId)}`);
  return mapOrder(await res.json());
}
