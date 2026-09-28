import { useEffect, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { NotFoundPage } from "~/components/not-found";
import { LoadingBadge } from "~/components/loading-badge";
import { ProductImageGallery } from "~/components/product-image-gallery";
import { ProductPrice } from "~/components/product-price";
import { VariantColorDots, VariantPicker } from "~/components/variant-picker";
import { brandToSlug } from "~/lib/catalog";
import { telegramContactUrl } from "~/lib/contact";
import {
  type Bag,
  type ProductVariant,
  type ServerProduct,
  addToWishlist,
  bagImage,
  fetchAvailableStock,
  fetchProduct,
  fetchRecommendations,
  listWishlist,
  productImage,
  removeFromWishlist,
} from "~/lib/api";
import { getMe } from "~/lib/auth";
import { useLanguage } from "~/lib/i18n";
import { formatDimensionsCm } from "~/lib/product-dimensions";
import { defaultVariant, withVariant } from "~/lib/product-variants";
import { useShippingFeeWon } from "~/lib/useShippingFee";
import {
  hasSellableVariant,
  isProductInStock,
  resolveEmbeddedStock,
} from "~/lib/product-stock";
import { useCart } from "~/lib/useCart";
import { useCartMutation } from "~/lib/useCartMutation";
import { useProductSheet } from "~/lib/useProductSheet";

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
      <main className="animate-pulse">
        <div className="lg:flex lg:items-start">
          <div className="aspect-[5/6] w-full bg-zinc-100 lg:w-1/2" />
          <div className="w-full space-y-4 px-4 py-8 lg:w-1/2 lg:px-16 lg:py-10 xl:px-24">
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
      <ProductLayout product={product} />
      <RelatedProducts seedId={product.id} />
    </main>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function Breadcrumb({
  product,
  className = "",
}: {
  product: ServerProduct;
  className?: string;
}) {
  const { t, translateProductName } = useLanguage();
  const brandSlug = brandToSlug(product.brand);

  // Lives inside the info column rather than in a full-width band above the
  // page: against a full-bleed gallery there is no left edge to align to, so
  // it shares the product title's instead.
  return (
    <nav
      aria-label="Breadcrumb"
      className={`${className} items-center gap-2 overflow-x-auto whitespace-nowrap text-[10px] uppercase tracking-widest text-zinc-400 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      <Link to="/" className="shrink-0 transition hover:text-zinc-950">
        {t("product.home")}
      </Link>
      <ChevronIcon />
      <Link
        to="/category/product-type/handbags"
        className="shrink-0 transition hover:text-zinc-950"
      >
        {t("product.bags")}
      </Link>
      <ChevronIcon />
      <Link
        to={brandSlug ? `/category/brand/${brandSlug}` : "/category/product-type/handbags"}
        className="shrink-0 transition hover:text-zinc-950"
      >
        {product.brand}
      </Link>
      <ChevronIcon />
      <span className="max-w-[14rem] truncate text-zinc-600 sm:max-w-xs lg:max-w-[22rem]">
        {translateProductName(product.id, product.name)}
      </span>
    </nav>
  );
}

// ── Main product layout ────────────────────────────────────────────────────

function ProductLayout({ product: parent }: { product: ServerProduct }) {
  const { t, translateProductName } = useLanguage();
  const variants = parent.variants ?? [];
  const [variant, setVariant] = useState<ProductVariant | undefined>(() => defaultVariant(parent));
  // The rest of the page reads the product as the selected color/size.
  const product = withVariant(parent, variant);
  const fallback = productImage(product.category, product.brand, product.image);
  const images = (product.images?.length ? product.images : [fallback]).map((src) => ({
    src,
    position: "object-center",
  }));

  const [activeImg, setActiveImg] = useState(0);
  const [wishlist, setWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const navigate = useNavigate();
  const sheet = useProductSheet();
  const imagesKey = images.map((img) => img.src).join("|");

  // A color with its own photos swaps the gallery; start it from the top.
  useEffect(() => {
    setActiveImg(0);
  }, [imagesKey]);

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
    // --pdp-gallery-h: below lg the gallery fills what the collapsed bottom
    // sheet leaves of the viewport; useProductSheet measures the parts.
    <div
      ref={sheet.rootRef}
      className="[--pdp-gallery-h:calc(var(--pdp-vh,100svh)-var(--pdp-header,5.5rem)-var(--pdp-peek,12rem))]"
    >
      <div className="lg:flex lg:items-start">

        {/* ── Left: full-bleed images — edge to edge, no thumbnail rail;
             scrolling them is how you browse the product. Below lg they are
             a vertical scroller of their own under the bottom sheet. ─────── */}
        <div className="lg:w-1/2" style={sheet.galleryStyle}>
          <ProductImageGallery
            key={imagesKey}
            images={images}
            activeIndex={activeImg}
            onActiveIndexChange={setActiveImg}
            alt={translateProductName(product.id, product.name)}
            badge={badge}
            scrollerRef={sheet.galleryRef}
            onScrollerScroll={sheet.onGalleryScroll}
            scrollLocked={sheet.open}
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

        {/* ── Right: product info. From lg: pinned in place while the gallery
             scrolls, capped to the viewport so a tall column (open accordions,
             long names) stays reachable. Below lg: the bottom sheet — its head
             (brand, name, color dots) peeks under the gallery; drag it up, tap
             its handle, or scroll to the last image to open it. */}
        <div
          ref={sheet.sheetRef}
          style={sheet.sheetStyle}
          {...sheet.sheetHandlers}
          className={[
            "w-full px-4 pb-8 lg:sticky lg:top-[7.75rem] lg:max-h-[calc(100vh-7.75rem)] lg:w-1/2 lg:overflow-y-auto lg:px-16 lg:py-10 xl:px-24",
            "max-lg:relative max-lg:z-20 max-lg:bg-white max-lg:transition-transform max-lg:duration-300 max-lg:ease-[cubic-bezier(0.4,0,0.2,1)]",
            sheet.open ? "" : "max-lg:touch-none",
          ].join(" ")}
        >
          <SheetHandle
            expanded={sheet.open}
            label={sheet.open ? t("product.hideDetails") : t("product.showDetails")}
            onClick={sheet.toggle}
          />
          <div className="mx-auto w-full max-w-[520px]">
            <Breadcrumb product={product} className="mb-5 hidden lg:flex" />
            <ProductInfo
              product={product}
              variants={variants}
              selectedVariant={variant}
              onSelectVariant={setVariant}
              onShowVariants={sheet.show}
              headEndRef={sheet.headEndRef}
            />
            <Breadcrumb product={product} className="mt-10 flex lg:hidden" />
          </div>
        </div>
      </div>

      {/* The sheet's handle, pinned under the header once the open sheet has
          scrolled it away. Portalled: the page transition wrapper keeps a
          transform, which would otherwise anchor `fixed` to it. */}
      {sheet.pinnedTop !== null &&
        createPortal(
          <div
            className="fixed inset-x-0 z-30 bg-white lg:hidden"
            style={{ top: sheet.pinnedTop }}
          >
            <SheetHandle
              expanded
              label={t("product.hideDetails")}
              onClick={sheet.close}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

/** Bottom sheet grip (below lg only): a short bar that toggles the sheet. */
function SheetHandle({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      onClick={onClick}
      className="block w-full py-3.5 lg:hidden"
    >
      <span className="mx-auto block h-0.5 w-12 rounded-full bg-zinc-950" />
    </button>
  );
}

// ── Product Info ───────────────────────────────────────────────────────────

function ProductInfo({
  product,
  variants,
  selectedVariant,
  onSelectVariant,
  onShowVariants,
  headEndRef,
}: {
  product: ServerProduct;
  variants: ProductVariant[];
  selectedVariant: ProductVariant | undefined;
  onSelectVariant: (variant: ProductVariant) => void;
  /** Mobile: open the bottom sheet from its head's color dots. */
  onShowVariants: () => void;
  /** End of what the folded mobile sheet shows (brand and name). */
  headEndRef?: Ref<HTMLDivElement>;
}) {
  const {
    t,
    language,
    formatCurrency,
    translateProductDescription,
    translateProductName,
    translateValue,
  } = useLanguage();
  const shippingFeeWon = useShippingFeeWon();
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
  // Still polling inventory: keep the bag button (disabled) rather than
  // flashing the inquiry link at a shopper who can in fact buy.
  const stockPending = sellable && availableStock === null;
  // Nothing to sell right now. The page never says "out of stock" — it hands
  // the shopper to the consultation bot, which can check restocks and
  // alternatives, with this product as the chat's context.
  const inquireStock = !inStock && !stockPending;
  const inquireUrl = telegramContactUrl({
    context: { surface: "product", ref: product.id, language },
  });
  const dimensions = formatDimensionsCm(product.dimensions, (axis) =>
    t(`product.dimension.${axis}`)
  );
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

  // Below lg the column is a bottom sheet whose head must be name, price and
  // bag button, so the CTA moves up (flex `order`) and the rest follows it.
  return (
    <div className="flex flex-col gap-0">

      {/* Brand + name — all the folded mobile sheet shows (with the color
          dots); price and bag button sit just under the fold until it opens */}
      <div ref={headEndRef} className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={brandLink}
            className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c8a96e] transition hover:opacity-70"
          >
            {product.brand}
          </Link>

          <h1
            className="mt-1 break-keep text-2xl font-medium tracking-[-0.01em] text-zinc-950 md:text-3xl lg:mt-2 lg:text-5xl lg:font-normal"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {translateProductName(product.id, product.name)}
          </h1>
        </div>
        <div className="mb-1.5 lg:hidden">
          <VariantColorDots variants={variants} onClick={onShowVariants} />
        </div>
      </div>

      {/* Price — far enough below the name that none of it shows in the
          folded sheet (its head ends PEEK_BOTTOM_GAP_PX under the name) */}
      <div className="mt-5 lg:hidden">
        <ProductPrice price={product.price} officialPrice={product.officialPrice} />
      </div>
      <div className="mt-5 hidden items-baseline gap-3 lg:flex">
        <ProductPrice
          price={product.price}
          officialPrice={product.officialPrice}
          size="lg"
        />
      </div>

      {/* Color / size — under the price from lg; below lg it opens with the
          sheet, right after the bag button (the head shows color dots) */}
      {variants.length > 0 && (
        <div className="mt-6 max-lg:order-2">
          <VariantPicker variants={variants} selected={selectedVariant} onSelect={onSelectVariant} />
        </div>
      )}

      <div className="my-6 h-px bg-zinc-100 max-lg:order-2" />

      {/* Description */}
      <p className="text-sm leading-relaxed text-zinc-500 max-lg:order-2">
        {translateProductDescription(product.id, product.description)}
      </p>

      {/* Details */}
      <dl className="mt-6 grid grid-cols-2 max-lg:order-2 gap-x-6 gap-y-4 text-xs">
        {[
          [t("product.brand"), product.brand],
          [t("product.category"), translateValue("category", product.category || "Bags")],
          [t("product.material"), product.material ? translateValue("material", product.material) : t("product.premiumLeather")],
          [t("product.color"), product.color ? translateValue("color", product.color) : "—"],
          [t("product.dimensions"), dimensions || "—"],
        ].map(([dt, dd], index, rows) => (
          // The last row (dimensions) spans both columns: "W 34 × H 22 × D 8 cm"
          // does not fit half the info column on a phone.
          <div key={dt} className={index === rows.length - 1 ? "col-span-2" : undefined}>
            <dt className="font-semibold uppercase tracking-widest text-zinc-400">{dt}</dt>
            <dd className="mt-0.5 text-zinc-700">{dd}</dd>
          </div>
        ))}
      </dl>

      <div className="my-6 h-px bg-zinc-100 max-lg:hidden" />

      {/* CTA — a single dominant "Add to Bag" action, with instant checkout
          as a lighter secondary link underneath; with nothing to sell, one
          "Inquire about stock" link to the consultation bot instead */}
      <div className="flex flex-col gap-3 max-lg:order-1 max-lg:mt-4">
        <div>
          {inquireStock ? (
            <InquireStockLink href={inquireUrl} label={t("product.inquireStock")} />
          ) : (
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
                "flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold transition lg:h-14",
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
              ) : (
                t("product.addToBag")
              )}
            </button>
          )}
        </div>

        {!inquireStock && (
          <button
            type="button"
            disabled={!inStock || adding}
            onClick={() => void handleBuy()}
            className="text-center text-sm font-medium text-zinc-950 underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            {t("product.buy")}
          </button>
        )}
        {cartError && (
          <p className="text-center text-[11px] text-red-600" role="alert">
            {cartError}
          </p>
        )}
      </div>

      {/* Detail links */}
      <div className="mt-8 border-t border-zinc-100 max-lg:order-2">
        {[
          {
            title: t("product.productDetails"),
            body: t("product.productDetailsBody"),
          },
          {
            title: t("product.shippingReturns"),
            body:
              shippingFeeWon === 0
                ? t("product.shippingReturnsBodyFree")
                : t("product.shippingReturnsBody", {
                    amount: formatCurrency(shippingFeeWon),
                  }),
          },
          {
            title: t("product.qualityAssurance"),
            body: t("product.authenticityBody"),
          },
        ].map((item) => (
          <AccordionItem key={item.title} title={item.title} body={item.body} />
        ))}
      </div>

    </div>
  );
}

/** Opens the consultation bot in Telegram, in place of the bag button. */
function InquireStockLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-12 w-full items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 lg:h-14"
    >
      {label}
    </a>
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

function RelatedProducts({ seedId }: { seedId: string }) {
  const { t, translateProductName } = useLanguage();
  const [products, setProducts] = useState<Bag[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRecommendations(seedId, 8)
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [seedId]);

  if (products.length === 0) return null;

  return (
    <section className="border-t border-zinc-100 px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {t("product.similarItems")}
        </p>
        <h2
          className="mt-2 text-2xl font-light text-zinc-950 md:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("product.youMayAlsoLike")}
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
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
              <ProductPrice
                price={product.price}
                officialPrice={product.officialPrice}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
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

