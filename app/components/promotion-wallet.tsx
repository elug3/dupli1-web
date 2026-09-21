import { useEffect, useState } from "react";

import type { CartItem } from "~/lib/cart";
import { useLanguage } from "~/lib/i18n";
import {
  type WalletEntry,
  fetchWallet,
  promotionMessageKey,
} from "~/lib/promotions";

/**
 * Loads the signed-in customer's promotional codes, judged against the bag.
 *
 * Re-priced whenever the bag changes, because eligibility usually turns on it:
 * a code needing 100,000원 is ineligible until the bag reaches it, and the
 * shopper should watch that change rather than wonder why.
 */
export function usePromotionWallet(items: CartItem[], shippingFeeWon: number) {
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPriceWon * item.quantity,
    0
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    let cancelled = false;
    fetchWallet({ items, shippingFeeWon })
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the priced bag rather than the array identity, which changes
    // whenever product names finish loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, itemCount, shippingFeeWon]);

  return { entries, loaded };
}

/**
 * The customer's codes, at the moment they would use one.
 *
 * An account-scoped code is issued rather than typed — the sign-up campaign
 * mints one on registration — so without this list a shopper has no way to
 * learn they hold it. Ineligible codes are shown with the reason instead of
 * being hidden.
 */
export function PromotionWallet({
  entries,
  appliedCode,
  onApply,
  formatCurrency,
}: {
  entries: WalletEntry[];
  appliedCode?: string;
  onApply: (code: string) => void;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useLanguage();
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
        {t("promo.walletTitle")}
      </p>
      <ul className="mt-2 space-y-2">
        {entries.map((entry) => {
          const applied = appliedCode === entry.code;
          return (
            <li
              key={entry.entitlementId}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <p className="font-mono font-semibold tracking-wider text-zinc-950">
                  {entry.code}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {entry.eligible
                    ? t("promo.walletSaves", {
                        amount: formatCurrency(entry.discountWon),
                      })
                    : entry.rejection
                      ? t(promotionMessageKey(entry.rejection))
                      : entry.description}
                </p>
              </div>
              {entry.eligible && !applied && (
                <button
                  type="button"
                  onClick={() => onApply(entry.code)}
                  className="shrink-0 border border-zinc-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
                >
                  {t("cart.apply")}
                </button>
              )}
              {applied && (
                <span className="shrink-0 text-[10px] uppercase tracking-widest text-emerald-700">
                  {t("promo.walletApplied")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
