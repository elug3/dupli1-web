import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { addToWishlist, listWishlist, removeFromWishlist } from "./api";
import { getMe } from "./auth";

/**
 * Wishlist state for a product listing: one `listWishlist()` per page rather
 * than one per card. Signed-out shoppers get an empty set, and toggling sends
 * them to login and back to the page they were on.
 */
export function useWishlist() {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    let cancelled = false;
    listWishlist()
      .then((items) => {
        if (!cancelled) setIds(new Set(items.map((item) => item.id)));
      })
      .catch(() => {
        // Signed-out or wishlist unavailable — leave every heart empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (productId: string) => {
      if (busy.has(productId)) return;
      const toLogin = () =>
        navigate(`/login?next=${encodeURIComponent(pathname + search)}`);
      setBusy((prev) => new Set(prev).add(productId));
      try {
        const user = await getMe();
        if (!user) {
          toLogin();
          return;
        }
        const wishlisted = ids.has(productId);
        if (wishlisted) {
          await removeFromWishlist(productId);
        } else {
          await addToWishlist(productId);
        }
        setIds((prev) => {
          const next = new Set(prev);
          if (wishlisted) next.delete(productId);
          else next.add(productId);
          return next;
        });
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.toLowerCase().includes("session expired")
        ) {
          toLogin();
        }
      } finally {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [busy, ids, navigate, pathname, search]
  );

  return { has: (id: string) => ids.has(id), isBusy: (id: string) => busy.has(id), toggle };
}
