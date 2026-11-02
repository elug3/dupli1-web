import { useLanguage } from "../lib/i18n";

/**
 * The selling price (판매가) a shopper pays. The official / list price is
 * deliberately never shown on the storefront (SER-94), so there is no
 * struck-through reference price or discount framing here.
 */
export function ProductPrice({
  price,
  size = "sm",
}: {
  price: number;
  size?: "sm" | "lg";
}) {
  const { formatCurrency } = useLanguage();

  if (size === "lg") {
    return (
      <span className="text-3xl font-semibold tracking-tight text-zinc-950">
        {formatCurrency(price)}
      </span>
    );
  }

  return <p className="mt-0.5 text-small text-mute">{formatCurrency(price)}</p>;
}
