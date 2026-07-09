import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { NotFoundPage } from "~/components/not-found";
import { LoadingBadge } from "~/components/loading-badge";
import { ProductImageGallery } from "~/components/product-image-gallery";
import { ProductPrice } from "~/components/product-price";
import { TELEGRAM_URL } from "../lib/contact";
import { brandToSlug } from "../lib/catalog";
import { type ServerProduct, fetchProduct, productImage } from "../lib/api";
import { pushRecentView } from "../lib/history";
import { useLanguage } from "../lib/i18n";
import { useWishlist } from "../lib/useWishlist";
import { useCart } from "../lib/useCart";
import { useCartMutation } from "../lib/useCartMutation";

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
      .then((p) => {
        setProduct(p);
        setStatus("ok");
        pushRecentView({
          id: p.id,
          name: p.name,
          brand: p.brand,
          image: p.image,
        });
      })
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

  useEffect(() => {
    setActiveImg(0);
  }, [product.id]);

  const badge = (() => {
    const b = getBadge(product);
    return b ? (
      <span className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider ${b.style}`}>
        {t(b.labelKey)}
      </span>
    ) : null;
  })();

  return (
    <div className="mx-auto max-w-7xl px-0 md:px-8 md:py-10">
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
          />
        </div>

        {/* ── Right: product info ──────────────────────────────────────── */}
        <div className="w-full px-4 py-8 md:w-[420px] md:shrink-0 md:px-0 md:py-0">
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
    translateProductDescription,
    translateProductName,
    translateValue,
  } = useLanguage();
  const { addItem, isPending, getAction } = useCartMutation();
  const { isWishlisted, toggle } = useWishlist();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const wishlist = isWishlisted(product.id);
  const adding = isPending(product.id) && getAction(product.id) === "add";
  const inStock = product.stock > 0;
  const brandSlug = brandToSlug(product.brand);
  const brandLink = brandSlug
    ? `/category/brand/${brandSlug}`
    : "/category/product-type/handbags";

  async function handleAddToBag() {
    if (adding) return;
    await addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: productImage(product.category, product.brand, product.image),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  async function handleBuy() {
    if (!inStock || adding) return;
    await handleAddToBag();
    navigate("/checkout");
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
        <ProductPrice price={product.price} size="lg" />
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

      {/* CTAs */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={!inStock || adding}
          onClick={handleBuy}
          className={[
            "flex h-14 flex-1 items-center justify-center text-xs font-semibold uppercase tracking-widest transition",
            inStock && !adding
              ? "bg-zinc-950 text-white hover:bg-zinc-800"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400",
          ].join(" ")}
        >
          {adding ? (
            <LoadingBadge label={t("product.addingToBag")} size="lg" />
          ) : inStock ? (
            t("product.buy")
          ) : (
            t("product.outOfStock")
          )}
        </button>

        <button
          type="button"
          disabled={!inStock || adding}
          onClick={handleAddToBag}
          aria-label={
            adding
              ? t("product.addingToBag")
              : added
                ? t("product.added")
                : t("product.addToBag")
          }
          aria-busy={adding}
          className={[
            "flex h-14 w-14 shrink-0 items-center justify-center border transition",
            inStock && !adding
              ? added
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
              : "cursor-not-allowed border-zinc-100 text-zinc-300",
          ].join(" ")}
        >
          {adding ? (
            <span
              className="size-2 animate-pulse rounded-full bg-[#c8a96e]"
              aria-hidden="true"
            />
          ) : added ? (
            <CheckIcon />
          ) : (
            <BagIcon />
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            toggle({
              productId: product.id,
              name: product.name,
              brand: product.brand,
              price: product.price,
              image: productImage(product.category, product.brand, product.image),
            })
          }
          aria-label={wishlist ? t("product.removeWishlist") : t("product.addWishlist")}
          className="flex h-14 w-14 shrink-0 items-center justify-center border border-zinc-200 text-zinc-500 transition hover:border-zinc-950 hover:text-zinc-950"
        >
          <HeartIcon filled={wishlist} />
        </button>
      </div>

      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 border border-zinc-200 text-xs font-semibold uppercase tracking-widest text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950"
      >
        <TelegramIcon />
        {t("product.contactUsTelegram")}
      </a>

      {/* Trust signals */}
      <div className="mt-8 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-6">
        {[
          { icon: ShieldIcon, label: t("product.authenticity"), sub: t("product.guaranteed") },
          { icon: TruckIcon, label: t("product.freeShipping"), sub: t("product.over100") },
          { icon: ReturnIcon, label: t("product.easyReturns"), sub: t("product.days30") },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 text-center">
            <Icon />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-700">{label}</p>
            <p className="text-[9px] text-zinc-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Accordion details */}
      <div className="mt-8 space-y-0 border-t border-zinc-100">
        {[
          {
            title: t("product.productDetails"),
            body: t("product.productDetailsBody"),
          },
          {
            title: t("product.shippingReturns"),
            body: t("product.shippingReturnsBody"),
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

function AccordionItem({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
          {title}
        </span>
        <span className={`text-zinc-400 transition ${open ? "rotate-45" : ""}`}>
          <PlusIcon />
        </span>
      </button>
      {open && (
        <p className="pb-4 text-xs leading-relaxed text-zinc-400">{body}</p>
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" className={`size-3.5 ${filled ? "fill-[#c8a96e]" : "fill-zinc-200"}`} viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M20 7 10 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 7h15l-1.5 11H7.5L6 7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 7V5a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.04 15.29 8.7 19c.43 0 .62-.18.84-.4l2.02-1.93 4.18 3.06c.77.42 1.31.2 1.5-.72l2.72-12.76h.01c.24-1.12-.4-1.56-1.12-1.3L2.6 9.44c-1.08.42-1.06 1.02-.18 1.29l4.9 1.53L18.6 7.1c.45-.28.86-.13.52.19" />
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

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="size-5 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 4 7v5c0 5.25 3.5 10.15 8 11.25C16.5 22.15 20 17.25 20 12V7l-8-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg aria-hidden="true" className="size-5 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="M5 17H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2m0 0h3l3 4v4h-2m-4-6H14m0 0v6m0-6h7m-7 6H8m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg aria-hidden="true" className="size-5 text-zinc-400" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 1 0 2.35-5.65M4 5v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}
