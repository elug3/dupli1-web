import { useLanguage } from "../lib/i18n";

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
  const { formatCurrency } = useLanguage();

  const showOfficial =
    typeof officialPrice === "number" &&
    Number.isFinite(officialPrice) &&
    officialPrice > price;

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
    </p>
  );
}
