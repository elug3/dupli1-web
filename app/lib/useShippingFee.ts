import { useEffect, useState } from "react";

import { SHIPPING_FEE } from "./cart";
import { getShippingFeeCents } from "./checkout";

// Shared across announcement, home, product, cart, and checkout so a single
// GET /api/v1/orders/settings serves every surface on the page.
let cached: number | null | undefined;
let inflight: Promise<number | null> | null = null;

/** Test hook: drop the in-memory settings answer so the next load hits fetch. */
export function resetShippingFeeCache(): void {
  cached = undefined;
  inflight = null;
}

/** Treat a missing/failed settings read as the display fallback, never as free. */
export function resolvedShippingFee(fee: number | null | undefined): number {
  return typeof fee === "number" && fee >= 0 ? fee : SHIPPING_FEE;
}

export function loadShippingFeeCents(): Promise<number | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!inflight) {
    inflight = getShippingFeeCents()
      .then((fee) => {
        cached = fee;
        return fee;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Delivery charge the order service publishes, in whole KRW.
 * Falls back to SHIPPING_FEE until settings answers (or if it never does).
 * An explicit 0 is free delivery, not "unset".
 */
export function useShippingFeeCents(): number {
  const [fee, setFee] = useState(() => resolvedShippingFee(cached ?? undefined));

  useEffect(() => {
    let cancelled = false;
    loadShippingFeeCents().then((loaded) => {
      if (!cancelled && loaded !== null) setFee(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return fee;
}
