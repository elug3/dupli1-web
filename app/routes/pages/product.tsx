import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { NotFoundPage } from "~/components/not-found";
import { LoadingBadge } from "~/components/loading-badge";
import { ProductImageGallery } from "~/components/product-image-gallery";
import { ProductPrice } from "~/components/product-price";
import { brandToSlug } from "~/lib/catalog";
import {
  type ServerProduct,
  addToWishlist,
  fetchAvailableStock,
  fetchProduct,
  listWishlist,
  productImage,
  removeFromWishlist,
} from "~/lib/api";
import { getMe } from "~/lib/auth";
import { SHIPPING_FEE } from "~/lib/cart";
import { useLanguage } from "~/lib/i18n";
import {
  hasSellableVariant,
  isProductInStock,
  resolveEmbeddedStock,
} from "~/lib/product-stock";
import { useCart } from "~/lib/useCart";
import { useCartMutation } from "~/lib/useCartMutation";

export function meta() {
  return [
    { title: "Product | Dupli1" },
    { name: "description", content: "Authentic luxury bag." },
  ];
}

export default function ProductPage() {
  const { t } = useLanguage();
  const { id } = useParams();
  const [product, setProduct] = useState<ServerProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    if (!id) { setStatus("error"); return; }
    fetchProduct(id)
      .then((p) => { setProduct(p); setStatus("ok"); })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-7xl animate-pulse px-4 py-10 md:px-8">
        <div className="flex flex-col gap-10 md:flex-row">
          <div className="flex-1 bg-zinc-100" style={{ paddingBottom: "120%" }} />
          <div className="w-full space-y-4 md:w-[420px]">
            <div className="h-4 w-24 rounded bg-zinc-100" />
            <div className="h-10 w-64 rounded bg-zinc-100" />
            <div className="h-8 w-32 rounded bg-zinc-100" />
          </div>
        </div>
      </main>
    );
  }

  if (status === "error" || !product) {
    return (
      <NotFoundPage
        eyebrow={t("product.noProduct")}
        title={t("product.notFound")}
        description={t("product.notFoundDescription")}
        primaryAction={{ label: t("product.browseAllBags"), to: "/" }}
      />
    );
  }

  return (
    <main className="bg-white">
      <Breadcrumb product={product} />
      <ProductLayout product={product} />
    </main>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function Breadcrumb({ product }: { product: ServerProduct }) {
  const { t, translateProductName } = useLanguage();
  const brandSlug = brandToSlug(product.brand);

  return (
    <div className="border-b border-zinc-100 px-4 py-3 md:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
          <Link to="/" className="transition hover:text-zinc-950">{t("product.home")}</Link>
          <ChevronIcon />
          <Link to="/category/product-type/handbags" className="transition hover:text-zinc-950">{t("product.bags")}</Link>
          <ChevronIcon />
          <Link
            to={brandSlug ? `/category/brand/${brandSlug}` : "/category/product-type/handbags"}
            className="transition hover:text-zinc-950"
          >
            {product.brand}
          </Link>
          <ChevronIcon />
          <span className="text-zinc-600">{translateProductName(product.id, product.name)}</span>
        </nav>
      </div>
    </div>
  );
}

// ── Main product layout ────────────────────────────────────────────────────

function ProductLayout({ product }: { product: ServerProduct }) {
  const { t, translateProductName } = useLanguage();
  const fallback = productImage(product.category, product.brand, product.image);
  const images = (product.images?.length ? product.images : [fallback]).map((src) => ({
    src,
    position: "object-center",
  }));

  const [activeImg, setActiveImg] = useState(0);
  const [wishlist, setWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveImg(0);
    setWishlist(false);
    let cancelled = false;
    listWishlist()
      .then((items) => {
        if (!cancelled) {
          setWishlist(items.some((item) => item.id === product.id));
        }
      })
      .catch(() => {
        // Signed-out or wishlist unavailable — leave heart empty.
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  async function toggleWishlist() {
    if (wishlistBusy) return;
    setWishlistBusy(true);
    try {
      const user = await getMe();
      if (!user) {
        navigate(
          `/login?next=${encodeURIComponent(`/product/${product.id}`)}`
        );
        return;
      }
      if (wishlist) {
        await removeFromWishlist(product.id);
        setWishlist(false);
      } else {
        await addToWishlist(product.id);
        setWishlist(true);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes("session expired")
      ) {
        navigate(
          `/login?next=${encodeURIComponent(`/product/${product.id}`)}`
        );
      }
    } finally {
      setWishlistBusy(false);
    }
  }

  const badge = (() => {
    const b = getBadge(product);
    return b ? (
      <span className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider ${b.style}`}>
        {t(b.labelKey)}
      </span>
    ) : null;
  })();

  return (
    <div className="mx-auto max-w-7xl px-0 pb-24 md:px-8 md:py-10 md:pb-10">
      <div className="flex flex-col md:flex-row md:gap-12 lg:gap-20">

        {/* ── Left: image gallery ──────────────────────────────────────── */}
        <div className="flex-1 md:flex md:gap-4">

          {/* Thumbnail strip — desktop only */}
          <div className="hidden flex-col gap-2 md:flex">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImg(i)}
                className={[
                  "h-20 w-16 overflow-hidden bg-zinc-50 transition",
                  activeImg === i
                    ? "ring-1 ring-zinc-950"
                    : "opacity-50 hover:opacity-80",
                ].join(" ")}
              >
                <img
                  src={img.src}
                  alt=""
                  className={`h-full w-full object-cover ${img.position}`}
                />
              </button>
            ))}
          </div>

          <ProductImageGallery
            images={images}
            activeIndex={activeImg}
            onActiveIndexChange={setActiveImg}
            alt={translateProductName(product.id, product.name)}
            badge={badge}
            actions={
              <button
                type="button"
                onClick={() => void toggleWishlist()}
                disabled={wishlistBusy}
                aria-label={wishlist ? t("product.removeWishlist") : t("product.addWishlist")}
                className="flex size-10 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-sm backdrop-blur-sm transition hover:text-zinc-950 disabled:opacity-60"
              >
                <HeartIcon filled={wishlist} />
              </button>
            }
          />
        </div>

        {/* ── Right: product info — pinned in place while the gallery scrolls,
             matching the flagship PDP pattern of keeping price/CTA always in view */}
        <div className="w-full px-4 py-8 md:w-[420px] md:shrink-0 md:self-start md:sticky md:top-28 md:px-0 md:py-0">
          <ProductInfo product={product} />
        </div>
      </div>
    </div>
  );
}

// ── Product Info ───────────────────────────────────────────────────────────

function ProductInfo({ product }: { product: ServerProduct }) {
  const {
    t,
    formatCurrency,
    translateProductDescription,
    translateProductName,
    translateValue,
  } = useLanguage();
  const mutation = useCartMutation();
  const { addItem, isPending, getAction, authRequired, error: cartError } = mutation;
  const navigate = useNavigate();
  const location = useLocation();
  const [added, setAdded] = useState(false);
  // Prefer PDP-embedded availability; poll only when fields were omitted.
  const embeddedStock = resolveEmbeddedStock(product);
  const [availableStock, setAvailableStock] = useState<number | null>(embeddedStock);
  const sellable = hasSellableVariant(product);
  const adding =
    isPending(product.sku, product.skuId) && getAction(product.sku, product.skuId) === "add";
  const inStock = isProductInStock(product, availableStock);
  const brandSlug = brandToSlug(product.brand);
  const brandLink = brandSlug
    ? `/category/brand/${brandSlug}`
    : "/category/product-type/handbags";

  useEffect(() => {
    if (authRequired) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
    }
  }, [authRequired, navigate, location.pathname]);

  useEffect(() => {
    if (typeof product.availableQty === "number") {
      setAvailableStock(product.availableQty);
      return;
    }
    if (typeof product.inStock === "boolean") {
      setAvailableStock(product.inStock ? 1 : 0);
      return;
    }
    setAvailableStock(null);
    if (!sellable) return;
    fetchAvailableStock(product.sku, product.skuId)
      .then((qty) => setAvailableStock(qty ?? 0))
      .catch(() => setAvailableStock(0));
  }, [sellable, product.sku, product.skuId, product.availableQty, product.inStock]);

  async function handleAddToBag(): Promise<boolean> {
    if (adding || !sellable) return false;
    const ok = await addItem(product.sku, 1, product.skuId);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
    return ok;
  }

  async function handleBuy() {
    if (!inStock || adding) return;
    // Do not navigate when add failed (e.g. variant not found) — mutation
    // used to swallow errors and Buy still opened checkout.
    const ok = await handleAddToBag();
    if (ok) navigate("/checkout");
  }

  return (
    <div className="flex flex-col gap-0">

      {/* Brand */}
      <Link
        to={brandLink}
        className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c8a96e] transition hover:opacity-70"
      >
        {product.brand}
      </Link>

      {/* Name */}
      <h1
        className="mt-2 text-4xl font-light leading-tight text-zinc-950 md:text-5xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {translateProductName(product.id, product.name)}
      </h1>

      {/* Price + stock */}
      <div className="mt-5 flex items-baseline gap-3">
        <ProductPrice
          price={product.price}
          officialPrice={product.officialPrice}
          size="lg"
        />
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${inStock ? "text-emerald-600" : "text-zinc-400"}`}
        >
          {inStock ? t("product.inStock") : t("product.outOfStock")}
        </span>
      </div>

      <div className="my-6 h-px bg-zinc-100" />

      {/* Description */}
      <p className="text-sm leading-relaxed text-zinc-500">
        {translateProductDescription(product.id, product.description)}
      </p>

      {/* Details */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-xs">
        {[
          [t("product.brand"), product.brand],
          [t("product.category"), translateValue("category", product.category || "Bags")],
          [t("product.material"), product.material ? translateValue("material", product.material) : t("product.premiumLeather")],
          [t("product.color"), product.color ? translateValue("color", product.color) : "—"],
        ].map(([dt, dd]) => (
          <div key={dt}>
            <dt className="font-semibold uppercase tracking-widest text-zinc-400">{dt}</dt>
            <dd className="mt-0.5 text-zinc-700">{dd}</dd>
          </div>
        ))}
      </dl>

      <div className="my-6 h-px bg-zinc-100" />

      {/* CTA — a single dominant "Add to Bag" action, with instant checkout
          as a lighter secondary link underneath */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={!inStock || adding}
          onClick={() => void handleAddToBag()}
          aria-label={
            adding
              ? t("product.addingToBag")
              : added
                ? t("product.added")
                : t("product.addToBag")
          }
          aria-busy={adding}
          className={[
            "flex h-14 w-full items-center justify-center rounded-md text-sm font-semibold transition",
            inStock && !adding
              ? added
                ? "bg-emerald-700 text-white"
                : "bg-zinc-950 text-white hover:bg-zinc-800"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400",
          ].join(" ")}
        >
          {adding ? (
            <LoadingBadge label={t("product.addingToBag")} size="lg" />
          ) : added ? (
            t("product.added")
          ) : inStock ? (
            t("product.addToBag")
          ) : (
            t("product.outOfStock")
          )}
        </button>

        <button
          type="button"
          disabled={!inStock || adding}
          onClick={() => void handleBuy()}
          className="text-center text-sm font-medium text-zinc-950 underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:text-zinc-300"
        >
          {t("product.buy")}
        </button>
        {cartError && (
          <p className="text-center text-[11px] text-red-600" role="alert">
            {cartError}
          </p>
        )}
      </div>

      {/* Detail links */}
      <div className="mt-8 border-t border-zinc-100">
        {[
          {
            title: t("product.productDetails"),
            body: t("product.productDetailsBody"),
          },
          {
            title: t("product.shippingReturns"),
            body: t("product.shippingReturnsBody", { amount: formatCurrency(SHIPPING_FEE) }),
          },
          {
            title: t("product.qualityAssurance"),
            body: t("product.authenticityBody"),
          },
        ].map((item) => (
          <AccordionItem key={item.title} title={item.title} body={item.body} />
        ))}
      </div>

      {/* Persistent purchase bar — mobile only; the sticky info column above
          already keeps the CTA in view on md+ viewports */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-zinc-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm md:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            {translateProductName(product.id, product.name)}
          </p>
          <p className="text-sm font-semibold text-zinc-950">
            {formatCurrency(product.price)}
          </p>
        </div>
        <button
          type="button"
          disabled={!inStock || adding}
          onClick={() => void handleAddToBag()}
          className={[
            "flex h-12 shrink-0 items-center justify-center rounded-md px-8 text-sm font-semibold transition",
            inStock && !adding
              ? "bg-zinc-950 text-white hover:bg-zinc-800"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400",
          ].join(" ")}
        >
          {adding ? (
            <LoadingBadge label={t("product.addingToBag")} />
          ) : added ? (
            t("product.added")
          ) : inStock ? (
            t("product.addToBag")
          ) : (
            t("product.outOfStock")
          )}
        </button>
      </div>
    </div>
  );
}

function AccordionItem({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-sm font-medium text-zinc-950">
          {title}
        </span>
        <span className={`text-zinc-400 transition ${open ? "rotate-45" : ""}`}>
          <PlusIcon />
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-zinc-500">{body}</p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getBadge(product: ServerProduct) {
  if (product.status === "new") return { labelKey: "product.badgeNew", style: "bg-white text-zinc-950 border border-zinc-200" };
  if (product.status === "featured") return { labelKey: "product.badgeFeatured", style: "bg-[#c8a96e] text-white" };
  return null;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="size-3 text-zinc-300" viewBox="0 0 24 24" fill="none">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

