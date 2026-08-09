// Client for the Dupli1 cart service (`/api/v1/cart`, proxied through the
// session gateway). See elug3/dupli1 docs/cart-service.md.
//
// Cart is per-authenticated-customer only — there is no guest cart yet.
// Line items key on variant SKU / sku_id; prices are server-sourced.

/** Flat shipping fee (KRW) charged on every order. */
export const SHIPPING_FEE = 30000;

export class CartAuthRequiredError extends Error {
  constructor() {
    super("Sign in required to use the bag");
    this.name = "CartAuthRequiredError";
  }
}

/** Identifies a sellable variant for cart mutations. Prefer skuId when known. */
export interface CartItemRef {
  sku: string;
  /** Canonical ULID from product variants (`skuId` / cart `sku_id`). */
  skuId?: string;
}

/** One backend cart line, enriched with product/stock data on read. */
export interface CartLine {
  sku: string;
  skuId?: string;
  productId: string;
  quantity: number;
  /**
   * Unit amount in whole KRW won (JSON field `unit_price_cents`).
   * For KRW this is Stripe minor units — do not divide by 100.
   */
  unitPriceCents: number;
  color?: string;
  imageUrl?: string;
  availableQty?: number;
}

/** A cart line joined with catalog display fields the cart service doesn't store. */
export interface CartItem extends CartLine {
  name: string;
  brand: string;
  /** Display price in KRW won (same unit as unitPriceCents). */
  price: number;
  image: string;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  promoApplied: boolean;
}

export type CartStatus = "idle" | "loading" | "ready" | "guest" | "error";

interface CartState {
  status: CartStatus;
  items: CartLine[];
  subtotalCents: number;
  error?: string;
}

let state: CartState = { status: "idle", items: [], subtotalCents: 0 };
const listeners = new Set<() => void>();

function setState(next: CartState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCartSnapshot(): CartState {
  return state;
}

interface RawCartLine {
  sku: string;
  sku_id?: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  color?: string;
  image_url?: string;
  available_qty?: number;
}

function mapLine(raw: RawCartLine): CartLine {
  return {
    sku: raw.sku,
    skuId: raw.sku_id || undefined,
    productId: raw.product_id,
    quantity: raw.quantity,
    unitPriceCents: raw.unit_price_cents,
    color: raw.color || undefined,
    imageUrl: raw.image_url || undefined,
    availableQty: raw.available_qty,
  };
}

function findLine(ref: CartItemRef): CartLine | undefined {
  if (ref.skuId) {
    const byId = state.items.find((item) => item.skuId === ref.skuId);
    if (byId) return byId;
  }
  return state.items.find((item) => item.sku === ref.sku);
}

function mutationBody(ref: CartItemRef, quantity: number): string {
  const body: { sku?: string; sku_id?: string; quantity: number } = { quantity };
  const skuId = ref.skuId?.trim();
  // Cart + product GetVariant use exact-match SQL; cart uppercases on write,
  // but send uppercase from the client so lookups stay consistent.
  const sku = ref.sku?.trim().toUpperCase();
  if (skuId) body.sku_id = skuId;
  if (sku) body.sku = sku;
  return JSON.stringify(body);
}

function normalizeRef(skuOrRef: string | CartItemRef, skuId?: string): CartItemRef {
  if (typeof skuOrRef === "string") {
    return { sku: skuOrRef, skuId };
  }
  return skuOrRef;
}

async function cartRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  // Via session gateway so production ALB does not send this to the raw proxy
  // without a Bearer token (see /auth/session/gateway in routes.ts).
  const res = await fetch(`/auth/session/gateway${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  if (res.status === 401) throw new CartAuthRequiredError();
  return res;
}

async function applyCartResponse(res: Response): Promise<void> {
  if (!res.ok) throw new Error(`Cart request failed: ${res.status}`);
  const body = (await res.json()) as { items?: RawCartLine[] | null; subtotal_cents?: number };
  setState({
    status: "ready",
    items: (body.items ?? []).map(mapLine),
    subtotalCents: body.subtotal_cents ?? 0,
  });
}

export async function refreshCart(): Promise<void> {
  setState({ ...state, status: "loading" });
  try {
    await applyCartResponse(await cartRequest("/api/v1/cart"));
  } catch (err) {
    if (err instanceof CartAuthRequiredError) {
      setState({ status: "guest", items: [], subtotalCents: 0 });
      return;
    }
    setState({
      status: "error",
      items: [],
      subtotalCents: 0,
      error: err instanceof Error ? err.message : "Failed to load your bag",
    });
  }
}

/** Upsert-by-SKU with an absolute quantity (the backend replaces, not adds). */
export async function setItemQuantity(
  skuOrRef: string | CartItemRef,
  quantity: number,
  skuId?: string
): Promise<void> {
  const ref = normalizeRef(skuOrRef, skuId);
  if (quantity <= 0) {
    await removeItem(ref);
    return;
  }
  await applyCartResponse(
    await cartRequest("/api/v1/cart/items", {
      method: "POST",
      body: mutationBody(ref, quantity),
    })
  );
}

/** Adds `incrementBy` to whatever quantity of the variant is already in the cart. */
export async function addToCart(
  skuOrRef: string | CartItemRef,
  incrementBy = 1,
  skuId?: string
): Promise<void> {
  const ref = normalizeRef(skuOrRef, skuId);
  const existing = findLine(ref);
  await setItemQuantity(ref, (existing?.quantity ?? 0) + incrementBy);
}

export async function removeItem(skuOrRef: string | CartItemRef, skuId?: string): Promise<void> {
  const ref = normalizeRef(skuOrRef, skuId);
  const path = ref.skuId
    ? `/api/v1/cart/items/by-sku-id/${encodeURIComponent(ref.skuId)}`
    : `/api/v1/cart/items/${encodeURIComponent(ref.sku)}`;
  await applyCartResponse(await cartRequest(path, { method: "DELETE" }));
}

export async function clearCart(): Promise<void> {
  const res = await cartRequest("/api/v1/cart", { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to clear bag: ${res.status}`);
  setState({ status: "ready", items: [], subtotalCents: 0 });
}

export function getCartCount(): number {
  return state.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function computeTotals(
  items: CartLine[],
  /** Subtotal in whole KRW won (`subtotal_cents` from the cart service). */
  subtotalCents: number,
  discountFraction: number
): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // KRW is zero-decimal: *_cents fields are already whole won.
  const subtotal = subtotalCents;
  const promoApplied = discountFraction > 0 && subtotal > 0;
  const discount = promoApplied ? subtotal * discountFraction : 0;
  const afterDiscount = subtotal - discount;
  const shipping = itemCount === 0 ? 0 : SHIPPING_FEE;
  const total = afterDiscount + shipping;

  return { itemCount, subtotal, shipping, discount, total, promoApplied };
}

export interface RedeemedCoupon {
  code: string;
  discount: number;
  description: string;
}

/** Validates a coupon against the public product-service redeem endpoint. */
export async function redeemCoupon(code: string): Promise<RedeemedCoupon | null> {
  const res = await fetch("/api/coupons/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { code: string; discount: number; description: string };
  return body;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}
