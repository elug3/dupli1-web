const KEY = "dupli1_wishlist";
const WISHLIST_EVENT = "dupli1-wishlist-update";
const MAX_ITEMS = 50;

export interface WishlistItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  addedAt: number;
}

let _cachedJson = "";
let _cachedItems: WishlistItem[] = [];

function emitWishlistUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WISHLIST_EVENT));
  }
}

export function wishlistEventName(): string {
  return WISHLIST_EVENT;
}

export function getWishlist(): WishlistItem[] {
  try {
    const json = localStorage.getItem(KEY) ?? "[]";
    if (json !== _cachedJson) {
      _cachedJson = json;
      _cachedItems = JSON.parse(json) as WishlistItem[];
    }
    return _cachedItems;
  } catch {
    return [];
  }
}

export function isWishlisted(productId: string): boolean {
  return getWishlist().some((item) => item.productId === productId);
}

export function addToWishlist(item: Omit<WishlistItem, "addedAt">): void {
  const list = getWishlist().filter((entry) => entry.productId !== item.productId);
  const updated = [{ ...item, addedAt: Date.now() }, ...list].slice(0, MAX_ITEMS);
  const json = JSON.stringify(updated);
  localStorage.setItem(KEY, json);
  _cachedJson = json;
  _cachedItems = updated;
  emitWishlistUpdate();
}

export function removeFromWishlist(productId: string): void {
  const updated = getWishlist().filter((item) => item.productId !== productId);
  const json = JSON.stringify(updated);
  localStorage.setItem(KEY, json);
  _cachedJson = json;
  _cachedItems = updated;
  emitWishlistUpdate();
}

export function toggleWishlist(item: Omit<WishlistItem, "addedAt">): boolean {
  if (isWishlisted(item.productId)) {
    removeFromWishlist(item.productId);
    return false;
  }
  addToWishlist(item);
  return true;
}
