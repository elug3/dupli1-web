import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";

const PRICE_LOAD_DELAY_MS = 800;

export function ProductPrice({
  price,
  size = "sm",
}: {
  price: number;
  size?: "sm" | "lg";
}) {
  const { formatCurrency, t } = useLanguage();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), PRICE_LOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [price]);

  if (!ready) {
    return <PriceLoadingBadge label={t("product.priceLoading")} size={size} />;
  }

  if (size === "lg") {
    return (
      <span className="text-3xl font-semibold tracking-tight text-zinc-950">
        {formatCurrency(price)}
      </span>
    );
  }

  return (
    <p className="mt-1.5 text-sm font-semibold text-zinc-950">
      {formatCurrency(price)}
    </p>
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
