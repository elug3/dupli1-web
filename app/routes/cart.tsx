import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type Bag, fetchBags, bagImage } from "../lib/api";
import { SHIPPING_FEE, redeemCoupon, type RedeemedCoupon } from "../lib/cart";
import { useLanguage } from "../lib/i18n";
import { CartLineControls } from "../components/cart-line-controls";
import { ProductPrice } from "../components/product-price";
import { useCart } from "../lib/useCart";
import { useCartMutation } from "../lib/useCartMutation";

export function meta() {
  return [
    { title: "Shopping Bag — Dupli1" },
    {
      name: "description",
      content: "Review your selected luxury bags and proceed to checkout.",
    },
  ];
}

export default function CartPage() {
  const { t, formatCurrency, translateProductName } = useLanguage();
  const { items, status, totals } = useCart();
  const mutation = useCartMutation();
  const [coupon, setCoupon] = useState<RedeemedCoupon | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [recommendations, setRecommendations] = useState<Bag[]>([]);

  const summary = totals(coupon?.discount ?? 0);

  useEffect(() => {
    fetchBags().then((bags) => setRecommendations(bags.slice(0, 8))).catch(() => {});
  }, []);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setApplyingPromo(true);
    setPromoError("");
    const redeemed = await redeemCoupon(code);
    setApplyingPromo(false);
    if (redeemed) {
      setCoupon(redeemed);
    } else {
      setCoupon(null);
      setPromoError(t("cart.invalidPromo"));
    }
  }

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-10 md:py-14">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 transition hover:text-zinc-950"
        >
          <BackIcon />
          {t("cart.continueShopping")}
        </Link>

        <div className="mb-10 flex flex-col gap-2 md:mb-14 md:flex-row md:items-end md:justify-between">
          <h1
            className="text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("cart.shoppingBag")}
          </h1>
          {items.length > 0 && (
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              {summary.itemCount} {summary.itemCount === 1 ? t("cart.item") : t("cart.items")}
            </p>
          )}
        </div>

        {status === "guest" ? (
          <SignInPrompt />
        ) : status === "loading" || status === "idle" ? (
          <BagSkeleton />
        ) : items.length === 0 ? (
          <EmptyBag recommendations={recommendations} />
        ) : (
          <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
            <section aria-label={t("cart.bagItems")} className="space-y-0">
              {items.map((item) => (
                <article
                  key={item.skuId ?? item.sku}
                  className="grid grid-cols-[120px_1fr] gap-5 border-b border-zinc-100 py-8 first:pt-0 md:grid-cols-[160px_1fr]"
                >
                  <Link
                    to={`/product/${item.productId}`}
                    className="overflow-hidden bg-zinc-50"
                  >
                    <div className="relative" style={{ paddingBottom: "125%" }}>
                      <img
                        src={item.image}
                        alt={translateProductName(item.productId, item.name)}
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105"
                      />
                    </div>
                  </Link>

                  <div className="flex min-w-0 flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c8a96e]">
                        {item.brand}
                      </p>
                      <Link
                        to={`/product/${item.productId}`}
                        className="mt-1 block text-lg font-medium leading-snug text-zinc-950 transition hover:opacity-70 md:text-xl"
                      >
                        {translateProductName(item.productId, item.name)}
                      </Link>
                      {item.color && (
                        <p className="mt-2 text-[11px] uppercase tracking-widest text-zinc-400">
                          {item.color}
                        </p>
                      )}
                    </div>

                    <CartLineControls
                      sku={item.sku}
                      skuId={item.skuId}
                      quantity={item.quantity}
                      price={item.price}
                      mutation={mutation}
                    />
                  </div>
                </article>
              ))}
            </section>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <OrderSummary
                summary={summary}
                coupon={coupon}
                promoInput={promoInput}
                promoError={promoError}
                applyingPromo={applyingPromo}
                onPromoInputChange={setPromoInput}
                onApplyPromo={applyPromo}
                checkoutHref="/checkout"
                checkoutLabel={t("cart.proceedToCheckout")}
                disabled={mutation.pendingKey !== null}
              />
            </aside>
          </div>
        )}

        {items.length > 0 && (
          <Recommendations
            title={t("cart.completeTheLook")}
            subtitle={t("cart.mostViewed")}
            products={recommendations.slice(0, 4)}
          />
        )}
      </div>

      <HelpBar />
    </main>
  );
}

function EmptyBag({ recommendations }: { recommendations: Bag[] }) {
  const { t } = useLanguage();

  return (
    <>
      <div className="border-b border-zinc-100 py-16 text-center md:py-24">
        <p
          className="text-3xl font-light text-zinc-950 md:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("cart.empty")}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
          {t("cart.emptyDescription")}
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-12 items-center bg-zinc-950 px-10 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
        >
          {t("cart.shopBags")}
        </Link>
      </div>

      <Recommendations
        title={t("cart.pairsWellWith")}
        subtitle={t("cart.mostViewed")}
        products={recommendations}
      />
    </>
  );
}

function SignInPrompt() {
  const { t } = useLanguage();

  return (
    <div className="border-b border-zinc-100 py-16 text-center md:py-24">
      <p
        className="text-3xl font-light text-zinc-950 md:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("profile.signInToDupli1")}
      </p>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
        {t("profile.signInDescription")}
      </p>
      <Link
        to={`/login?next=${encodeURIComponent("/cart")}`}
        className="mt-8 inline-flex h-12 items-center bg-zinc-950 px-10 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
      >
        {t("login.signIn")}
      </Link>
    </div>
  );
}

function BagSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
      <div className="space-y-8">
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-[120px_1fr] gap-5 md:grid-cols-[160px_1fr]">
            <div className="aspect-[4/5] animate-pulse bg-zinc-100" />
            <div className="space-y-3 py-2">
              <div className="h-3 w-20 animate-pulse bg-zinc-100" />
              <div className="h-5 w-40 animate-pulse bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse bg-zinc-50" />
    </div>
  );
}

function Recommendations({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle: string;
  products: Bag[];
}) {
  const { translateProductName } = useLanguage();

  if (products.length === 0) return null;

  return (
    <section className="mt-16 border-t border-zinc-100 pt-12 md:mt-20 md:pt-16">
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {subtitle}
        </p>
        <h2
          className="mt-2 text-2xl font-light text-zinc-950 md:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {products.map((product) => (
          <Link key={product.id} to={`/product/${product.id}`} className="group">
            <div
              className="relative mb-3 overflow-hidden bg-zinc-50"
              style={{ paddingBottom: "120%" }}
            >
              <img
                src={bagImage(product.brand, product.image)}
                alt={translateProductName(product.id, product.name)}
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {product.brand}
            </p>
            <p className="mt-0.5 text-sm font-medium text-zinc-950">
              {translateProductName(product.id, product.name)}
            </p>
            <ProductPrice price={product.price} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function OrderSummary({
  summary,
  coupon,
  promoInput,
  promoError,
  applyingPromo = false,
  onPromoInputChange,
  onApplyPromo,
  checkoutHref,
  checkoutLabel,
  disabled = false,
}: {
  summary: ReturnType<ReturnType<typeof useCart>["totals"]>;
  coupon: RedeemedCoupon | null;
  promoInput: string;
  promoError: string;
  applyingPromo?: boolean;
  onPromoInputChange: (value: string) => void;
  onApplyPromo: () => void;
  checkoutHref: string;
  checkoutLabel: string;
  disabled?: boolean;
}) {
  const { t, formatCurrency } = useLanguage();

  return (
    <div className="border border-zinc-100 bg-zinc-50/50 p-6 md:p-8">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-950">
        {t("cart.orderSummary")}
      </h2>

      <dl className="mt-6 space-y-4 text-sm">
        <div className="flex justify-between text-zinc-600">
          <dt>{t("cart.subtotal")}</dt>
          <dd className="font-medium text-zinc-950">
            {formatCurrency(summary.subtotal)}
          </dd>
        </div>
        {summary.promoApplied && coupon && (
          <div className="flex justify-between text-emerald-700">
            <dt>{t("cart.promo", { code: coupon.code })}</dt>
            <dd className="font-medium">
              −{formatCurrency(summary.discount)}
            </dd>
          </div>
        )}
        <div className="flex justify-between text-zinc-600">
          <dt>{t("cart.shipping")}</dt>
          <dd className="font-medium text-zinc-950">
            {summary.shipping === 0 ? t("cart.complimentary") : formatCurrency(summary.shipping)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-4 text-base">
          <dt className="font-semibold uppercase tracking-widest text-zinc-950">
            {t("cart.total")}
          </dt>
          <dd className="text-xl font-semibold text-zinc-950">
            {formatCurrency(summary.total)}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <label
          htmlFor="promo-code"
          className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
        >
          {t("cart.promoCode")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="promo-code"
            type="text"
            value={promoInput}
            onChange={(e) => onPromoInputChange(e.target.value)}
            placeholder={t("cart.promoCode")}
            disabled={applyingPromo}
            className="h-11 flex-1 border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
          />
          <button
            type="button"
            onClick={onApplyPromo}
            disabled={applyingPromo}
            className="h-11 border border-zinc-950 px-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {t("cart.apply")}
          </button>
        </div>
        {promoError && (
          <p className="mt-2 text-[11px] text-red-600">{promoError}</p>
        )}
        {summary.promoApplied && coupon && (
          <p className="mt-2 text-[11px] text-emerald-700">
            {t("cart.discountApplied", { discount: Math.round(coupon.discount * 100) })}
          </p>
        )}
      </div>

      {disabled ? (
        <button
          type="button"
          disabled
          className="mt-6 flex h-14 w-full cursor-not-allowed items-center justify-center bg-zinc-200 text-[10px] font-semibold uppercase tracking-widest text-zinc-400"
        >
          {checkoutLabel}
        </button>
      ) : (
        <Link
          to={checkoutHref}
          className="mt-6 flex h-14 w-full items-center justify-center bg-zinc-950 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
        >
          {checkoutLabel}
        </Link>
      )}

      <ul className="mt-6 space-y-2 border-t border-zinc-200 pt-6 text-[11px] text-zinc-400">
        <li className="flex items-center gap-2">
          <ShieldIcon />
          {t("cart.authenticityGuaranteed")}
        </li>
        <li className="flex items-center gap-2">
          <TruckIcon />
          {t("cart.shippingFeeNote", { amount: formatCurrency(SHIPPING_FEE) })}
        </li>
        <li className="flex items-center gap-2">
          <ReturnIcon />
          {t("cart.returns")}
        </li>
      </ul>
    </div>
  );
}

function HelpBar() {
  const { t } = useLanguage();

  return (
    <section className="mt-16 border-t border-zinc-100 bg-zinc-50 px-4 py-12 md:mt-20 md:px-10">
      <div className="mx-auto max-w-7xl text-center">
        <p
          className="text-xl font-light text-zinc-950 md:text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("cart.needAssistance")}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          {t("cart.assistanceDescription")}
        </p>
        <a
          href="mailto:concierge@dupli1.com"
          className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 underline-offset-4 hover:underline"
        >
          concierge@dupli1.com
        </a>
      </div>
    </section>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 4 7v5c0 5.25 3.5 10.15 8 11.25C16.5 22.15 20 17.25 20 12V7l-8-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="M5 17H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2m0 0h3l3 4v4h-2m-4-6H14m0 0v6m0-6h7m-7 6H8m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 1 0 2.35-5.65M4 5v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}
