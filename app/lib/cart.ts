// Client for the Dupli1 cart service (`/api/v1/cart`, proxied through the
// session gateway). See elug3/dupli1 docs/cart-service.md.
//
// Cart is per-authenticated-customer only — there is no guest cart yet.
// Line items key on variant SKU / sku_id; prices are server-sourced.

/**
 * Offline fallback for the flat delivery charge (whole KRW) when
 * GET /api/v1/orders/settings has not answered yet, or cannot be reached.
 *
 * It is NOT the charged amount. The order service owns that
 * (DUPLI1_ORDER_SHIPPING_FEE_WON) and publishes it as `shipping_fee_won` on
 * settings, the checkout session, and the order. Storefront copy and totals
 * read those; leaving this constant on screen is how the two silently drift.
 */
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
   * Unit amount in whole KRW won (JSON field `unit_price_won`).
   * For KRW this is Stripe minor units — do not divide by 100.
   */
  unitPriceWon: number;
  color?: string;
  imageUrl?: string;
  availableQty?: number;
}

/** A cart line joined with catalog display fields the cart service doesn't store. */
export interface CartItem extends CartLine {
  name: string;
  brand: string;
  /** Display price in KRW won (same unit as unitPriceWon). */
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
  subtotalWon: number;
  error?: string;
}

let state: CartState = { status: "idle", items: [], subtotalWon: 0 };
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
  unit_price_won: number;
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
    unitPriceWon: raw.unit_price_won,
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
  const body = (await res.json()) as { items?: RawCartLine[] | null; subtotal_won?: number };
  setState({
    status: "ready",
    items: (body.items ?? []).map(mapLine),
    subtotalWon: body.subtotal_won ?? 0,
  });
}

/**
 * Drop cached cart state back to `idle` so the next `useCart` mount refetches.
 *
 * The store is a module singleton that outlives client-side navigation, so a
 * `guest` status set while signed out would otherwise stick after login and
 * bounce /checkout straight back to /login. Call on every session change.
 */
export function resetCart(): void {
  setState({ status: "idle", items: [], subtotalWon: 0 });
}

export async function refreshCart(): Promise<void> {
  setState({ ...state, status: "loading" });
  try {
    await applyCartResponse(await cartRequest("/api/v1/cart"));
  } catch (err) {
    if (err instanceof CartAuthRequiredError) {
      setState({ status: "guest", items: [], subtotalWon: 0 });
      return;
    }
    setState({
      status: "error",
      items: [],
      subtotalWon: 0,
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
  setState({ status: "ready", items: [], subtotalWon: 0 });
}

export function getCartCount(): number {
  return state.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function computeTotals(
  items: CartLine[],
  /** Subtotal in whole KRW won (`subtotal_won` from the cart service). */
  subtotalWon: number,
  /**
   * Discount in whole KRW won, as computed by the backend for this cart. It is
   * an absolute amount rather than a fraction because a code may be a flat won
   * amount, be capped, or draw on only some lines.
   */
  discountWon: number,
  /**
   * Delivery charge in whole KRW, from the order service — either the checkout
   * session's `shipping_fee_won` or the settings endpoint. Defaults to
   * SHIPPING_FEE when the service has not answered yet.
   */
  shippingFeeWon: number = SHIPPING_FEE
): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // KRW is zero-decimal: *_won fields are already whole won.
  const subtotal = subtotalWon;
  const promoApplied = discountWon > 0 && subtotal > 0;
  // Never discount past the goods: the total must stay at or above the
  // delivery charge, matching the order service's own clamp.
  const discount = promoApplied ? Math.min(discountWon, subtotal) : 0;
  const afterDiscount = subtotal - discount;
  // An empty bag owes nothing to ship — matches the order service, which quotes
  // a total of 0 for a session with no items rather than a bare delivery charge.
  const shipping = itemCount === 0 ? 0 : shippingFeeWon;
  const total = afterDiscount + shipping;

  return { itemCount, subtotal, shipping, discount, total, promoApplied };
}

export interface RedeemedPromotion {
  code: string;
  /** Discount in whole KRW won, computed by the backend against this cart. */
  discountWon: number;
  description: string;
}

/** A refused code, with the reason so the caller can pick the right copy. */
export interface RejectedPromotion {
  reason: string;
  subReason?: string;
}

export type PromotionPreview =
  | { ok: true; promotion: RedeemedPromotion }
  | { ok: false; rejection: RejectedPromotion };

/**
 * Previews a promotional code against the current cart.
 *
 * The amount comes from the backend, not from a fraction applied here: a code
 * may be a flat won amount, be capped, require a minimum spend, or draw on
 * only some lines, none of which the storefront can work out on its own.
 *
 * The preview is advisory — it is computed from the cart as the browser sees
 * it. Checkout complete re-evaluates against server-resolved prices and is the
 * authority on what is finally charged.
 */
export async function previewPromotion(
  code: string,
  items: CartItem[],
  shippingFeeWon: number
): Promise<PromotionPreview> {
  const res = await fetch("/api/promotions/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: code.trim().toUpperCase(),
      shipping_fee_won: shippingFeeWon,
      lines: items.map((item) => ({
        sku_id: item.skuId ?? "",
        sku: item.sku,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_won: item.unitPriceWon,
      })),
    }),
  });
  if (!res.ok) {
    return { ok: false, rejection: { reason: "invalid_code" } };
  }
  const body = (await res.json()) as {
    ok?: boolean;
    discount_won?: number;
    reason?: string;
    sub_reason?: string;
  };
  if (!body.ok) {
    return { ok: false, rejection: { reason: body.reason ?? "not_eligible", subReason: body.sub_reason } };
  }
  return {
    ok: true,
    promotion: {
      code: code.trim().toUpperCase(),
      discountWon: body.discount_won ?? 0,
      description: "",
    },
  };
}

/** Maps a preview rejection to the i18n key for what to tell the customer. */
export function promotionPreviewMessageKey(rejection: RejectedPromotion): string {
  switch (rejection.reason) {
    case "expired":
      return "cart.promoExpired";
    case "already_used":
      return "cart.promoAlreadyUsed";
    case "campaign_exhausted":
      return "cart.promoExhausted";
    case "login_required":
      return "cart.promoLoginRequired";
    case "not_eligible":
      return rejection.subReason === "min_spend" ? "cart.promoMinSpend" : "cart.promoNotEligible";
    default:
      return "cart.invalidPromo";
  }
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}
