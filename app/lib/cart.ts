// Client for the Dupli1 cart service (`/api/v1/cart`, proxied through our BFF
// routes). The backend cart is per-authenticated-customer only — there is no
// guest cart (see docs/cart-service.md) — so callers must be signed in.

/** Flat shipping fee (KRW) charged on every order, for every delivery speed. */
export const SHIPPING_FEE = 30000;

export class CartAuthRequiredError extends Error {
  constructor() {
    super("Sign in required to use the bag");
    this.name = "CartAuthRequiredError";
  }
}

/** One backend cart line, enriched with product/inventory data on read. */
export interface CartLine {
  sku: string;
  productId: string;
  quantity: number;
  /** Real-money unit cents, as returned by the cart service. */
  unitPriceCents: number;
  color?: string;
  imageUrl?: string;
  availableQty?: number;
}

/** A cart line joined with catalog display fields the cart service doesn't store. */
export interface CartItem extends CartLine {
  name: string;
  brand: string;
  /** Display-unit price (unitPriceCents / 100), matching product.price elsewhere. */
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
    productId: raw.product_id,
    quantity: raw.quantity,
    unitPriceCents: raw.unit_price_cents,
    color: raw.color || undefined,
    imageUrl: raw.image_url || undefined,
    availableQty: raw.available_qty,
  };
}

async function cartRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, credentials: "same-origin", headers });
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
export async function setItemQuantity(sku: string, quantity: number): Promise<void> {
  if (quantity <= 0) {
    await removeItem(sku);
    return;
  }
  await applyCartResponse(
    await cartRequest("/api/v1/cart/items", {
      method: "POST",
      body: JSON.stringify({ sku, quantity }),
    })
  );
}

/** Adds `incrementBy` to whatever quantity of `sku` is already in the cart. */
export async function addToCart(sku: string, incrementBy = 1): Promise<void> {
  const existing = state.items.find((item) => item.sku === sku);
  await setItemQuantity(sku, (existing?.quantity ?? 0) + incrementBy);
}

export async function removeItem(sku: string): Promise<void> {
  await applyCartResponse(
    await cartRequest(`/api/v1/cart/items/${encodeURIComponent(sku)}`, { method: "DELETE" })
  );
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
  subtotalCents: number,
  discountFraction: number
): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = subtotalCents / 100;
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
