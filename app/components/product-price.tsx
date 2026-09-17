import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";

const PRICE_LOAD_DELAY_MS = 800;

/** Percent off list price when selling price is lower; null when not a sale. */
export function saleDiscountPercent(
  price: number,
  officialPrice: number
): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(officialPrice)) return null;
  if (officialPrice <= 0 || officialPrice <= price) return null;
  const percent = Math.round((1 - price / officialPrice) * 100);
  return percent > 0 ? percent : null;
}

/**
 * True when the catalog carries no usable price yet.
 *
 * `product` stores price on the parent as `NUMERIC NOT NULL DEFAULT 0`, and
 * both product mappers coalesce an absent value to 0 — so an unpriced style
 * and a style priced at zero are the same thing on the wire. Either way the
 * storefront cannot quote it, and we invite an inquiry rather than render
 * "₩0" or a dead purchase button.
 */
export function isPriceOnRequest(price: number | null | undefined): boolean {
  return typeof price !== "number" || !Number.isFinite(price) || price <= 0;
}

export function ProductPrice({
  price,
  officialPrice,
  size = "sm",
}: {
  price: number;
  /** Reference list price; shown struck when greater than selling `price` (판매가). */
  officialPrice?: number;
  size?: "sm" | "lg";
}) {
  const { formatCurrency, t } = useLanguage();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), PRICE_LOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [price, officialPrice]);

  if (!ready) {
    return <PriceLoadingBadge label={t("product.priceLoading")} size={size} />;
  }

  // Before the sale math: against a zero price every officialPrice reads as
  // "-100%", which is the opposite of the invitation we want here.
  if (isPriceOnRequest(price)) {
    return <PriceOnRequestBadge label={t("product.priceOnRequest")} size={size} />;
  }

  const showOfficial =
    typeof officialPrice === "number" &&
    Number.isFinite(officialPrice) &&
    officialPrice > price;
  const discount = showOfficial
    ? saleDiscountPercent(price, officialPrice)
    : null;

  if (size === "lg") {
    return (
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight text-zinc-950">
          {formatCurrency(price)}
        </span>
        {showOfficial && (
          <span className="text-base font-medium text-zinc-400 line-through">
            {formatCurrency(officialPrice)}
          </span>
        )}
        {discount != null && (
          <span className="text-sm font-semibold tracking-tight text-rose-700">
            {t("product.discountPercent", { percent: discount })}
          </span>
        )}
      </span>
    );
  }

  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-semibold text-zinc-950">
      <span>{formatCurrency(price)}</span>
      {showOfficial && (
        <span className="text-xs font-medium text-zinc-400 line-through">
          {formatCurrency(officialPrice)}
        </span>
      )}
      {discount != null && (
        <span className="text-[11px] font-semibold text-rose-700">
          {t("product.discountPercent", { percent: discount })}
        </span>
      )}
    </p>
  );
}

/** Price slot for an unpriced style — an invitation, never a disabled state. */
function PriceOnRequestBadge({
  label,
  size,
}: {
  label: string;
  size: "sm" | "lg";
}) {
  if (size === "lg") {
    return (
      <span className="text-2xl font-light tracking-tight text-zinc-950">
        {label}
      </span>
    );
  }

  return (
    <p className="mt-1.5 text-sm font-semibold text-[#c8a96e]">{label}</p>
  );
}

function PriceLoadingBadge({
  label,
  size,
}: {
  label: string;
  size: "sm" | "lg";
}) {
  const className = [
    "inline-flex items-center gap-2 border border-zinc-200 bg-zinc-50 font-semibold uppercase tracking-widest text-zinc-500",
    size === "lg"
      ? "px-3 py-1.5 text-[10px]"
      : "mt-1.5 px-2 py-0.5 text-[9px]",
  ].join(" ");

  return (
    <span className={className} aria-live="polite" aria-busy="true">
      <span className="size-2 animate-pulse rounded-full bg-[#c8a96e]" />
      {label}
    </span>
  );
}
