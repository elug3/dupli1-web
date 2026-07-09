import { useCallback, useSyncExternalStore } from "react";
import {
  addToWishlist,
  getWishlist,
  isWishlisted,
  removeFromWishlist,
  toggleWishlist,
  wishlistEventName,
  type WishlistItem,
} from "./wishlist";

function subscribe(onStoreChange: () => void): () => void {
  const event = wishlistEventName();
  window.addEventListener(event, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(event, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getServerSnapshot(): WishlistItem[] {
  return [];
}

export function useWishlist() {
  const items = useSyncExternalStore(
    subscribe,
    getWishlist,
    getServerSnapshot
  );

  const checkWishlisted = useCallback(
    (productId: string) => isWishlisted(productId),
    [items]
  );

  const add = useCallback((item: Omit<WishlistItem, "addedAt">) => {
    addToWishlist(item);
  }, []);

  const remove = useCallback((productId: string) => {
    removeFromWishlist(productId);
  }, []);

  const toggle = useCallback((item: Omit<WishlistItem, "addedAt">) => {
    return toggleWishlist(item);
  }, []);

  return {
    items,
    count: items.length,
    isWishlisted: checkWishlisted,
    add,
    remove,
    toggle,
  };
}
