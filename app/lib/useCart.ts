import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { fetchProduct, productImage } from "./api";
import {
  computeTotals,
  getCartSnapshot,
  refreshCart,
  subscribeCart,
  type CartItem,
  type CartLine,
  type CartStatus,
  type CartTotals,
} from "./cart";
import { useShippingFeeKrw } from "./useShippingFee";

interface ProductMeta {
  name: string;
  brand: string;
  image: string;
}

// Must be a stable reference — useSyncExternalStore requires getServerSnapshot
// to return the same value on every call, or React treats it as an infinite
// loop of changes during hydration.
const SERVER_SNAPSHOT: {
  status: CartStatus;
  items: CartLine[];
  subtotalKrw: number;
  error?: string;
} = { status: "idle", items: [], subtotalKrw: 0 };

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function useCart() {
  const raw = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerSnapshot);
  const [meta, setMeta] = useState<Map<string, ProductMeta>>(new Map());

  useEffect(() => {
    if (raw.status === "idle") {
      refreshCart();
    }
  }, [raw.status]);

  useEffect(() => {
    const missing = Array.from(new Set(raw.items.map((item) => item.productId))).filter(
      (id) => !meta.has(id)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        fetchProduct(id)
          .then((p): [string, ProductMeta] => [
            id,
            { name: p.name, brand: p.brand, image: productImage(p.category, p.brand, p.image) },
          ])
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const resolved = results.filter((entry): entry is [string, ProductMeta] => entry != null);
      if (resolved.length === 0) return;
      setMeta((prev) => {
        const next = new Map(prev);
        for (const entry of resolved) {
          next.set(entry[0], entry[1]);
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [raw.items, meta]);

  const items: CartItem[] = raw.items.map((line) => {
    const productMeta = meta.get(line.productId);
    return {
      ...line,
      name: productMeta?.name ?? line.productId,
      brand: productMeta?.brand ?? "",
      // unit_price_krw is whole KRW won (zero-decimal); do not ÷100.
      price: line.unitPriceKrw,
      image: line.imageUrl ?? productMeta?.image ?? "",
    };
  });

  const count = raw.items.reduce((sum, item) => sum + item.quantity, 0);

  // Shared with announcement / home / product so every surface quotes the
  // fee GET /api/v1/orders/settings publishes. Until it resolves (or if it
  // fails), useShippingFeeKrw falls back to SHIPPING_FEE.
  const serviceShippingFee = useShippingFeeKrw();

  // An explicit shippingFeeKrw wins — pass the checkout session's
  // `shipping_fee_krw` once a session exists, since that quote is frozen for
  // the session and is what the resulting order will carry.
  const totals = useCallback(
    (discountFraction = 0, shippingFeeKrw?: number): CartTotals =>
      computeTotals(
        raw.items,
        raw.subtotalKrw,
        discountFraction,
        shippingFeeKrw ?? serviceShippingFee
      ),
    [raw.items, raw.subtotalKrw, serviceShippingFee]
  );

  const refresh = useCallback(() => refreshCart(), []);

  return {
    items,
    count,
    status: raw.status,
    error: raw.error,
    totals,
    refresh,
  };
}
