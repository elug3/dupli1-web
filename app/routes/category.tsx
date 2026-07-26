import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  type DisplayProduct,
  bannerBagImage,
  productImage,
  searchProducts,
} from "~/lib/api";
import {
  type CategoryFacet,
  BRAND_LOGOS,
  brandBlurbKey,
  brandDisplayName,
  buildCategorySearchParams,
  categoryDisplayLabel,
  isCategoryFacet,
  isFeaturedBrandSlug,
} from "~/lib/catalog";
import { NotFoundPage } from "~/components/not-found";
import { ProductPrice } from "~/components/product-price";
import { useLanguage } from "~/lib/i18n";

export function meta({
  params,
}: {
  params: { facet?: string; value?: string };
}) {
  const facet = params.facet;
  const value = params.value;

  if (facet === "brand" && value && isFeaturedBrandSlug(value)) {
    const name = brandDisplayName(value);
    return [
      { title: `${name} | Dupli1` },
      {
        name: "description",
        content: `Shop curated ${name} handbags at Dupli1.`,
      },
    ];
  }

  if (facet === "brand" && value) {
    const name = brandDisplayName(value);
    return [
      { title: `${name} | Dupli1` },
      {
        name: "description",
        content: `Browse ${name} bags at Dupli1.`,
      },
    ];
  }

  return [
    { title: "Shop Bags | Dupli1" },
    { name: "description", content: "Browse curated luxury handbags." },
  ];
}

function facetEyebrowKey(facet: CategoryFacet): string {
  switch (facet) {
    case "product-type":
      return "nav.productType";
    case "brand":
      return "nav.brand";
    case "style":
      return "nav.style";
    case "family":
      return "nav.family";
  }
}

export default function CategoryPage() {
  const { facet, value } = useParams();

  if (!facet || !value || !isCategoryFacet(facet)) {
    return <NotFoundPage />;
  }

  if (facet === "brand" && isFeaturedBrandSlug(value)) {
    return <FeaturedBrandPage slug={value} />;
  }

  return <FacetResults facet={facet} value={value} />;
}

// ── Shared layout pieces ─────────────────────────────────────────────────────

function CategoryShell({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
          <Link to="/" className="transition hover:text-zinc-950">
            {t("product.home")}
          </Link>
          <span>/</span>
          <span className="text-zinc-600">{title}</span>
        </nav>
      </div>

      {/* Solid-color banner — shared across every category/style/target/brand page */}
      <div className="mt-6 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center md:px-8 md:py-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c8a96e]">
            {eyebrow}
          </p>
          <h1
            className="mt-3 text-4xl font-light tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        {typeof count === "number" && (
          <p className="mb-6 text-sm text-zinc-400">
            {count} {count === 1 ? t("cart.item") : t("cart.items")}
          </p>
        )}

        {children}
      </div>
    </main>
  );
}

function ProductSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5 md:gap-y-12">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="mb-3 bg-zinc-100" style={{ paddingBottom: "110%" }} />
          <div className="h-2.5 w-16 rounded bg-zinc-100" />
          <div className="mt-1.5 h-3.5 w-32 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

function ProductGrid({ products }: { products: DisplayProduct[] }) {
  const { t, translateProductName } = useLanguage();

  if (products.length === 0) {
    return (
      <section className="border border-zinc-100 bg-zinc-50 px-6 py-16 text-center">
        <p className="text-sm text-zinc-500">{t("category.empty")}</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center bg-zinc-950 px-6 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
        >
          {t("product.browseAllBags")}
        </Link>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5 md:gap-y-12">
      {products.map((product) => (
        <Link key={product.id} to={`/product/${product.id}`} className="group">
          <div
            className="relative mb-3 overflow-hidden bg-zinc-50"
            style={{ paddingBottom: "110%" }}
          >
            <img
              src={productImage(
                product.category,
                String(product.details.Brand ?? ""),
                product.image
              )}
              alt={translateProductName(product.id, product.name)}
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {brandDisplayName(String(product.details.Brand ?? ""))}
          </p>
          <p className="mt-0.5 text-sm font-medium leading-snug text-zinc-950">
            {translateProductName(product.id, product.name)}
          </p>
          <ProductPrice price={product.price} officialPrice={product.officialPrice} />
        </Link>
      ))}
    </div>
  );
}

// ── Featured brand pages (LV / Hermès / Prada) ───────────────────────────────

function FeaturedBrandPage({ slug }: { slug: string }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const title = brandDisplayName(slug);
  const blurbKey = brandBlurbKey(slug);
  const blurb = blurbKey ? t(blurbKey) : "";
  const logo = BRAND_LOGOS[slug];

  useEffect(() => {
    setLoading(true);
    const params = buildCategorySearchParams("brand", slug);
    searchProducts("bags", params)
      .then((data) => setProducts(data.results))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [slug]);

  const heroProduct = products[0];
  const heroImage = heroProduct
    ? bannerBagImage(
        heroProduct.image,
        String(heroProduct.details.Brand ?? title)
      )
    : productImage("bags", title);

  return (
    <main className="bg-[#faf8f5]">
      <section className="relative min-h-[min(88vh,52rem)] overflow-hidden bg-[#141210]">
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-40 animate-[brand-hero-zoom_18s_ease-out_forwards]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(200,169,110,0.2),transparent_42%),linear-gradient(180deg,rgba(20,18,16,0.45)_0%,rgba(20,18,16,0.88)_70%,#141210_100%)]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-6 md:px-10">
          <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/55">
            <Link to="/" className="transition hover:text-white">
              {t("product.home")}
            </Link>
            <span>/</span>
            <span className="text-white/55">{t("nav.brand")}</span>
            <span>/</span>
            <span className="text-white/80">{title}</span>
          </nav>
        </div>

        <div className="relative mx-auto flex min-h-[min(calc(88vh-2.5rem),50rem)] max-w-7xl flex-col justify-end px-6 pb-14 pt-20 md:px-10 md:pb-20">
          <div className="max-w-2xl animate-[brand-fade-up_0.9s_ease-out_both]">
            {logo && (
              <img
                src={logo}
                alt=""
                aria-hidden
                className="mb-8 h-8 w-auto brightness-0 invert opacity-80 md:h-10"
              />
            )}
            <h1
              className="text-[clamp(2.75rem,8vw,5.25rem)] font-light leading-[0.95] tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h1>
            {blurb && (
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
                {blurb}
              </p>
            )}
            <a
              href="#brand-collection"
              className="mt-8 inline-flex h-12 items-center bg-white px-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-950 transition hover:bg-[#c8a96e] hover:text-white"
            >
              {t("brand.shopCollection")}
            </a>
          </div>
        </div>
      </section>

      <section
        id="brand-collection"
        className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16"
      >
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c8a96e]">
              {title}
            </p>
            <h2
              className="mt-2 text-3xl font-light tracking-tight text-zinc-950 md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("brand.collection")}
            </h2>
          </div>
          {!loading && (
            <p className="shrink-0 text-sm text-zinc-400">
              {products.length}{" "}
              {products.length === 1 ? t("cart.item") : t("cart.items")}
            </p>
          )}
        </div>

        {loading ? <ProductSkeletonGrid /> : <ProductGrid products={products} />}
      </section>

      <style>{`
        @keyframes brand-fade-up {
          from { opacity: 0; transform: translateY(1.25rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes brand-hero-zoom {
          from { transform: scale(1.06); }
          to { transform: scale(1); }
        }
      `}</style>
    </main>
  );
}

// ── Filtered product results ─────────────────────────────────────────────────

function FacetResults({
  facet,
  value,
}: {
  facet: CategoryFacet;
  value: string;
}) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const title = categoryDisplayLabel(facet, value, t);
  const eyebrow = t(facetEyebrowKey(facet));

  useEffect(() => {
    setLoading(true);
    const params = buildCategorySearchParams(facet, value);
    searchProducts("bags", params)
      .then((data) => setProducts(data.results))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [facet, value]);

  return (
    <CategoryShell
      eyebrow={eyebrow}
      title={title}
      count={loading ? undefined : products.length}
    >
      {loading ? <ProductSkeletonGrid /> : <ProductGrid products={products} />}
    </CategoryShell>
  );
}
