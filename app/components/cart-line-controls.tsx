import { LoadingBadge } from "./loading-badge";
import { useLanguage } from "../lib/i18n";
import { type useCartMutation } from "../lib/useCartMutation";

export function CartLineControls({
  sku,
  skuId,
  quantity,
  price,
  mutation,
}: {
  sku: string;
  skuId?: string;
  quantity: number;
  price: number;
  mutation: ReturnType<typeof useCartMutation>;
}) {
  const { t, formatCurrency } = useLanguage();
  const pending = mutation.isPending(sku, skuId);
  const action = mutation.getAction(sku, skuId);

  if (pending && action === "remove") {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <LoadingBadge label={t("cart.removing")} />
        <p className="text-base font-semibold text-zinc-950">
          {formatCurrency(price * quantity)}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div className="relative">
        {pending && (action === "increase" || action === "decrease") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
            <LoadingBadge label={t("cart.updating")} />
          </div>
        )}
        <QuantityControl
          quantity={quantity}
          disabled={pending}
          onDecrease={() => mutation.decreaseQuantity(sku, quantity, skuId)}
          onIncrease={() => mutation.increaseQuantity(sku, quantity, skuId)}
        />
      </div>

      <div className="text-right">
        <p className="text-base font-semibold text-zinc-950">
          {formatCurrency(price * quantity)}
        </p>
        {quantity > 1 && (
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {t("cart.each", { price: formatCurrency(price) })}
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => mutation.removeItem(sku, skuId)}
          className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 underline-offset-4 transition hover:text-zinc-950 hover:underline disabled:cursor-wait disabled:opacity-50"
        >
          {t("cart.remove")}
        </button>
      </div>
    </div>
  );
}

function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
  disabled = false,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex items-center border border-zinc-200">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled}
        aria-label={t("cart.decreaseQuantity")}
        className="flex h-10 w-10 items-center justify-center text-zinc-500 transition hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
      >
        <MinusIcon />
      </button>
      <span className="flex h-10 w-10 items-center justify-center text-sm font-medium text-zinc-950">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled}
        aria-label={t("cart.increaseQuantity")}
        className="flex h-10 w-10 items-center justify-center text-zinc-500 transition hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function MinusIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
