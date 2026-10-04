import { useEffect, useState } from "react";

import { CARD_SURCHARGE_BPS, getCardSurchargeBps } from "./checkout";

// One GET /api/v1/orders/settings answer shared by every surface on the page.
let cached: number | null | undefined;
let inflight: Promise<number | null> | null = null;

/** Test hook: drop the in-memory settings answer so the next load hits fetch. */
export function resetCardSurchargeCache(): void {
  cached = undefined;
  inflight = null;
}

function loadCardSurchargeBps(): Promise<number | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!inflight) {
    inflight = getCardSurchargeBps()
      .then((bps) => {
        cached = bps;
        return bps;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Card surcharge the order service publishes, in basis points (1000 = 10%).
 * Falls back to CARD_SURCHARGE_BPS until settings answers (or if it never
 * does). An explicit 0 means no surcharge.
 */
export function useCardSurchargeBps(): number {
  const [bps, setBps] = useState(() => cached ?? CARD_SURCHARGE_BPS);

  useEffect(() => {
    let cancelled = false;
    loadCardSurchargeBps().then((loaded) => {
      if (!cancelled && loaded !== null) setBps(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return bps;
}
