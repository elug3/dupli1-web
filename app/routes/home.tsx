import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  type Bag,
  diversifyBagsByBrand,
  fetchBags,
  fetchCuratedBag,
  bagImage,
  bannerBagImage,
  heroBagImage,
} from "../lib/api";
import {
  PRODUCT_TYPE_TO_SUBCATEGORY,
  brandDisplayName,
  brandToSlug,
} from "../lib/catalog";
import { SHIPPING_FEE } from "../lib/cart";
import { useLanguage } from "../lib/i18n";
import { ProductPrice } from "../components/product-price";

export function meta() {
  return [
    { title: "Dupli1 — Curated Luxury Bags" },
    { name: "description", content: "Authentic luxury bags from the world's most coveted brands." },
  ];
}

/** Soft preferences when the seeded id still exists in the filtered page. */
const HERO_BAG_ID = "bag-chanel-classic-flap-medium";
const EDITORIAL_BAG_ID = "bag-lv-capucines-bb";
const SUMMER_EDIT_BAG_ID = "bag-hermes-garden-party-30";

const categoryTiles = [
  {
    key: "handbags",
    slug: "handbags",
    titleKey: "home.categoryBags",
    to: "/category/product-type/handbags",
    className: "md:col-span-2 md:row-span-2 min-h-[18rem] md:min-h-[28rem]",
  },
  {
    key: "totes",
    slug: "totes",
    titleKey: "category.totes",
    to: "/category/product-type/totes",
    className: "min-h-[14rem]",
  },
  {
    key: "shoulder",
    slug: "shoulder-bags",
    titleKey: "category.shoulderBags",
    to: "/category/product-type/shoulder-bags",
    className: "min-h-[14rem]",
  },
  {
    key: "crossbody",
    slug: "crossbody",
    titleKey: "category.crossbody",
    to: "/category/product-type/crossbody",
    className: "min-h-[14rem] md:col-span-2",
  },
] as const;

const styleTiles = [
  { key: "casual", titleKey: "category.casual", to: "/category/style/casual" },
  { key: "evening", titleKey: "category.evening", to: "/category/style/evening" },
  { key: "business", titleKey: "category.business", to: "/category/style/business" },
  { key: "weekend", titleKey: "category.weekend", to: "/category/style/weekend" },
  { key: "statement", titleKey: "category.statement", to: "/category/style/statement" },
] as const;

/** Prefer these brands (API names) for the shop-by-brand strip. */
const HOME_BRAND_ORDER = [
  "Chanel",
  "Louis Vuitton",
  "Hermes",
  "Prada",
  "Balenciaga",
  "Loewe",
  "Miu Miu",
  "Saint Laurent",
] as const;

export default function Home() {
  return (
    <main className="bg-[#faf8f5]">
      <Hero />
      <ValueStrip />
      <CategoryMosaic />
      <EditorialSplit />
      <BrandTiles />
      <FeaturedBags />
      <StyleEdit />
      <PromoBanner />
    </main>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const { t } = useLanguage();
  const [heroBag, setHeroBag] = useState<Bag | null>(null);

  useEffect(() => {
    // Chanel spotlight: brand-scoped + popular, not the undifferentiated bags[0].
    fetchCuratedBag({
      brand: "Chanel",
      sort: "views",
      limit: 8,
      preferredId: HERO_BAG_ID,
    })
      .then(async (bag) => {
        if (bag) return bag;
        return fetchCuratedBag({ sort: "views", limit: 8 });
      })
      .then((bag) => setHeroBag(bag))
      .catch(() => {});
  }, []);

  const shopLink = heroBag ? `/product/${heroBag.id}` : "/category/product-type/handbags";
  const heroImage = heroBag
    ? (heroBag.image
        ? heroBag.image.replace(/w_\d+,h_\d+/, "w_1920,h_1280")
        : bannerBagImage(heroBag.image, heroBag.brand))
    : null;

  return (
    <section className="relative min-h-[calc(100vh-5.5rem)] overflow-hidden bg-[#1a1612] md:min-h-[calc(100vh-7.75rem)]">
      {heroImage ? (
        <img
          src={heroImage}
          alt={t("home.heroAlt")}
          className="absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-50 animate-home-hero-zoom md:opacity-55 md:object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-[#1a1612]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(26,22,18,0.88)_0%,rgba(26,22,18,0.55)_42%,rgba(26,22,18,0.28)_68%,rgba(26,22,18,0.72)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(200,169,110,0.14),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1a1612] to-transparent" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-7xl flex-col justify-end px-6 pb-14 pt-20 md:min-h-[calc(100vh-7.75rem)] md:justify-center md:px-10 md:pb-20 md:pt-24">
        <div className="max-w-xl">
          <p className="animate-home-fade-up mb-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#c8a96e]">
            <span className="origin-left h-px w-10 bg-[#c8a96e]/70 animate-home-rule" />
            {t("home.eyebrow")}
          </p>

          <p
            data-brand-logo
            className="animate-home-fade-up text-[clamp(3.25rem,10vw,6.5rem)] font-light leading-[0.9] tracking-[0.08em] text-white uppercase"
            style={{ fontFamily: "var(--font-display)", animationDelay: "80ms" }}
          >
            Dupli1
          </p>

          <h1
            className="animate-home-fade-up mt-5 text-[clamp(1.65rem,4.2vw,2.75rem)] font-light leading-[1.15] tracking-tight text-white/95"
            style={{ fontFamily: "var(--font-display)", animationDelay: "160ms" }}
          >
            {t("home.heroTitleLine1")}{" "}
            <span className="text-[#c8a96e]">{t("home.heroTitleLine2")}</span>
          </h1>

          <p
            className="animate-home-fade-up mt-5 max-w-md text-sm leading-relaxed text-white/65 md:text-[15px]"
            style={{ animationDelay: "240ms" }}
          >
            {t("home.heroDescription")}
          </p>

          <div
            className="animate-home-fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "320ms" }}
          >
            <Link
              to={shopLink}
              className="inline-flex h-12 items-center justify-center bg-[#c8a96e] px-9 text-xs font-semibold uppercase tracking-[0.2em] text-[#1a1612] transition hover:bg-[#d4b87a]"
            >
              {t("home.shopNow")}
            </Link>
            <Link
              to="/category/product-type/handbags"
              className="group inline-flex h-12 items-center justify-center px-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:text-white"
            >
              {t("home.styleConsult")}
              <span aria-hidden className="ml-2 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Value strip ────────────────────────────────────────────────────────────

function ValueStrip() {
  const { t, formatCurrency } = useLanguage();
  const values = [
    {
      titleKey: "home.valueShipping",
      icon: ShippingIcon,
      values: { amount: formatCurrency(SHIPPING_FEE) },
    },
    { titleKey: "home.valueAuthenticity", icon: ShieldIcon },
    { titleKey: "home.valueCuration", icon: StarIcon },
  ];

  return (
    <section className="border-y border-[#e8e0d4] bg-white">
      <div className="mx-auto grid max-w-7xl divide-y divide-[#e8e0d4] md:grid-cols-3 md:divide-x md:divide-y-0">
        {values.map(({ titleKey, icon: Icon, values: interpolation }) => (
          <div
            key={titleKey}
            className="flex items-center justify-center gap-4 px-6 py-5 text-center md:py-6"
          >
            <Icon />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-800">
              {t(titleKey, interpolation)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Category mosaic ──────────────────────────────────────────────────────────

function CategoryMosaic() {
  const { t } = useLanguage();
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      categoryTiles.map(async (tile) => {
        const subcategory = PRODUCT_TYPE_TO_SUBCATEGORY[tile.slug];
        let bags = await fetchBags({
          subcategory,
          sort: "views",
          limit: 1,
        }).catch(() => [] as Bag[]);

        // Taxonomy may be unset on older catalog rows — fall back to newest.
        if (bags.length === 0) {
          bags = await fetchBags({ sort: "newest", limit: 4 }).catch(
            () => [] as Bag[]
          );
        }

        const bag = bags[0];
        return [
          tile.key,
          bag ? heroBagImage(bag.image, bag.brand) : "",
        ] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setImages(Object.fromEntries(entries.filter(([, url]) => url)));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl md:mb-14">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9a7b45]">
            {t("home.categoryEyebrow")}
          </p>
          <h2
            className="text-4xl font-light tracking-tight text-zinc-950 md:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("home.categoryTitle")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            {t("home.categoryDescription")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 md:grid-rows-2">
          {categoryTiles.map((tile) => {
            const image = images[tile.key];
            return (
              <Link
                key={tile.key}
                to={tile.to}
                className={[
                  "group relative overflow-hidden bg-zinc-900",
                  tile.className,
                ].join(" ")}
              >
                {image ? (
                  <img
                    src={image}
                    alt={t(tile.titleKey)}
                    className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
                  />
                ) : (
                  <div className="absolute inset-0 animate-pulse bg-zinc-800" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8a96e]">
                    {t("home.categoryExplore")}
                  </p>
                  <h3
                    className="mt-2 text-2xl font-light text-white md:text-3xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t(tile.titleKey)}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Editorial split ──────────────────────────────────────────────────────────

function EditorialSplit() {
  const { t } = useLanguage();
  const [bag, setBag] = useState<Bag | null>(null);

  useEffect(() => {
    fetchCuratedBag({
      brand: "Louis Vuitton",
      sort: "newest",
      limit: 8,
      preferredId: EDITORIAL_BAG_ID,
    })
      .then(async (selected) => {
        if (selected) return selected;
        return fetchCuratedBag({ sort: "newest", limit: 8 });
      })
      .then(setBag)
      .catch(() => {});
  }, []);

  const ctaTo = bag
    ? brandToSlug(bag.brand)
      ? `/category/brand/${brandToSlug(bag.brand)}`
      : `/product/${bag.id}`
    : "/category/brand/louis-vuitton";

  return (
    <section className="overflow-hidden bg-zinc-950 text-white">
      <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 md:px-10 md:py-24 lg:px-14">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c8a96e]">
            {t("home.editorialEyebrow")}
          </p>
          <h2
            className="text-4xl font-light leading-tight tracking-tight md:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("home.editorialTitle")}
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/55">
            {t("home.editorialBody")}
          </p>
          <Link
            to={ctaTo}
            className="mt-10 inline-flex h-12 w-fit items-center border border-[#c8a96e]/50 px-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#c8a96e] transition hover:bg-[#c8a96e] hover:text-zinc-950"
          >
            {t("home.editorialCta")}
          </Link>
        </div>

        <div className="relative min-h-[22rem] lg:min-h-[32rem]">
          {bag ? (
            <>
              <img
                src={heroBagImage(bag.image, bag.brand)}
                alt={bag.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent lg:from-zinc-950/80" />
            </>
          ) : (
            <div className="absolute inset-0 animate-pulse bg-zinc-900" />
          )}
        </div>
      </div>
    </section>
  );
}

// ── Brand tiles ──────────────────────────────────────────────────────────────

function BrandTiles() {
  const { t } = useLanguage();
  const [tiles, setTiles] = useState<{ brand: string; id: string; image?: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    // One product per preferred house so tiles don't all share bags[0].
    Promise.all(
      HOME_BRAND_ORDER.map(async (brand) => {
        const bags = await fetchBags({
          brand,
          sort: "views",
          limit: 1,
        }).catch(() => [] as Bag[]);
        const bag = bags[0];
        if (!bag) return null;
        return { brand: bag.brand, id: bag.id, image: bag.image } as {
          brand: string;
          id: string;
          image?: string;
        };
      })
    ).then(async (preferred) => {
      if (cancelled) return;
      const tilesFromPreferred = preferred.flatMap((tile) =>
        tile ? [tile] : []
      );

      if (tilesFromPreferred.length >= 4) {
        setTiles(tilesFromPreferred);
        return;
      }

      // Fill from a broader newest page when some brands are missing.
      const more = await fetchBags({ sort: "newest", limit: 40 }).catch(
        () => [] as Bag[]
      );
      if (cancelled) return;

      const seen = new Set(
        tilesFromPreferred.map((tile) => tile.brand.trim().toLowerCase())
      );
      const merged = [...tilesFromPreferred];
      for (const bag of more) {
        const key = bag.brand.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push({ brand: bag.brand, id: bag.id, image: bag.image });
      }
      setTiles(merged);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (tiles.length === 0) return null;

  return (
    <section className="border-t border-[#e8e0d4] bg-white px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex items-end justify-between gap-4">
          <h2
            className="text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("home.shopByBrand")}
          </h2>
          <Link
            to="/category/brand"
            className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-950"
          >
            {t("home.viewAll")} →
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible md:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {tiles.map(({ brand, image }) => {
            const slug = brandToSlug(brand);
            const label = brandDisplayName(brand);
            return (
            <Link
              key={brand}
              to={slug ? `/category/brand/${slug}` : "/category/brand"}
              className="group relative w-[72vw] shrink-0 overflow-hidden bg-zinc-100 md:w-auto"
            >
              <div className="relative overflow-hidden" style={{ paddingBottom: "125%" }}>
                <img
                  src={bagImage(brand, image)}
                  alt={label}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/10 to-transparent transition duration-500 group-hover:from-zinc-950/90" />
                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                  <p
                    className="text-xl font-light text-white md:text-2xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {label}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8a96e] opacity-0 transition duration-300 group-hover:opacity-100">
                    {t("home.categoryExplore")} →
                  </p>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Featured bags ────────────────────────────────────────────────────────────

function FeaturedBags() {
  const { t, translateProductName } = useLanguage();
  const [bags, setBags] = useState<Bag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBags({ sort: "views", limit: 24 })
      .then((results) => setBags(diversifyBagsByBrand(results, 8)))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : t("home.failedToLoadBags"))
      )
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <section className="bg-[#faf8f5] px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-3 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9a7b45]">
              {t("home.featuredEyebrow")}
            </p>
            <h2
              className="mt-2 text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("home.featuredBags")}
            </h2>
          </div>
          <Link
            to="/category/product-type/handbags"
            className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 transition hover:text-zinc-950"
          >
            {t("home.seeAll")} →
          </Link>
        </div>

        {error && <p className="text-sm text-zinc-400">{error}</p>}

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6 md:gap-y-14">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="mb-4 bg-zinc-200" style={{ paddingBottom: "115%" }} />
                  <div className="h-2.5 w-16 bg-zinc-200" />
                  <div className="mt-2 h-3.5 w-32 bg-zinc-200" />
                  <div className="mt-2 h-3 w-20 bg-zinc-200" />
                </div>
              ))
            : bags.map((bag) => (
                <Link key={bag.id} to={`/product/${bag.id}`} className="group">
                  <div
                    className="relative mb-4 overflow-hidden bg-white"
                    style={{ paddingBottom: "115%" }}
                  >
                    <img
                      src={bagImage(bag.brand, bag.image)}
                      alt={bag.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-zinc-950/0 transition duration-500 group-hover:bg-zinc-950/5" />
                    {bag.stock <= 5 && bag.stock > 0 && (
                      <span className="absolute left-3 top-3 bg-zinc-950 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-white">
                        {t("home.lowStock")}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a7b45]">
                    {brandDisplayName(bag.brand)}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug text-zinc-950 transition group-hover:text-zinc-600">
                    {translateProductName(bag.id, bag.name)}
                  </p>
                  <ProductPrice price={bag.price} officialPrice={bag.officialPrice} />
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}

// ── Style edit ───────────────────────────────────────────────────────────────

function StyleEdit() {
  const { t } = useLanguage();
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      styleTiles.map(async (tile) => {
        let bags = await fetchBags({
          style: tile.key,
          sort: "views",
          limit: 1,
        }).catch(() => [] as Bag[]);

        if (bags.length === 0) {
          bags = await fetchBags({ sort: "newest", limit: 8 }).catch(
            () => [] as Bag[]
          );
        }

        const bag = bags[0];
        return [
          tile.key,
          bag ? bagImage(bag.brand, bag.image) : "",
        ] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setImages(Object.fromEntries(entries.filter(([, url]) => url)));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="border-t border-[#e8e0d4] bg-white px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9a7b45]">
            {t("home.styleEyebrow")}
          </p>
          <h2
            className="mt-2 text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("home.styleTitle")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            {t("home.styleDescription")}
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-5 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
          {styleTiles.map((tile) => {
            const image = images[tile.key];
            return (
              <Link
                key={tile.key}
                to={tile.to}
                className="group relative w-[58vw] shrink-0 overflow-hidden bg-zinc-900 md:w-auto"
              >
                <div className="relative min-h-[16rem] md:min-h-[18rem]">
                  {image ? (
                    <img
                      src={image}
                      alt={t(tile.titleKey)}
                      className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-85"
                    />
                  ) : (
                    <div className="absolute inset-0 animate-pulse bg-zinc-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3
                      className="text-xl font-light text-white"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {t(tile.titleKey)}
                    </h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Promo banner ─────────────────────────────────────────────────────────────

function PromoBanner() {
  const { t } = useLanguage();
  const [summerBag, setSummerBag] = useState<Bag | null>(null);

  useEffect(() => {
    // Use seeded ASCII "Hermes" (not Hermès) for the brand filter.
    fetchCuratedBag({
      brand: "Hermes",
      sort: "newest",
      limit: 8,
      preferredId: SUMMER_EDIT_BAG_ID,
    })
      .then(async (bag) => {
        if (bag) return bag;
        return fetchCuratedBag({
          subcategory: "tote",
          sort: "views",
          limit: 8,
        });
      })
      .then(setSummerBag)
      .catch(() => {});
  }, []);

  const shopLink = summerBag
    ? `/product/${summerBag.id}`
    : "/category/brand/hermes";

  return (
    <section className="relative overflow-hidden">
      {summerBag ? (
        <img
          src={bannerBagImage(summerBag.image, summerBag.brand)}
          alt={t("home.summerEditAlt")}
          className="h-[28rem] w-full object-cover md:h-[36rem]"
        />
      ) : (
        <div className="h-[28rem] w-full animate-pulse bg-zinc-200 md:h-[36rem]" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/55 px-6 text-center text-white backdrop-blur-[1px]">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#c8a96e]">
          {t("home.limitedTime")}
        </p>
        <h3
          className="text-5xl font-light md:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("home.summerEdit")}
        </h3>
        <p className="mt-3 text-sm tracking-[0.15em] text-white/70">{t("home.saleDescription")}</p>
        <Link
          to={shopLink}
          className="mt-8 inline-flex h-12 items-center bg-[#c8a96e] px-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-950 transition hover:bg-[#d4b87a]"
        >
          {t("home.shopSale")}
        </Link>
      </div>
    </section>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function ShippingIcon() {
  return (
    <svg aria-hidden="true" className="size-5 text-[#c8a96e]" viewBox="0 0 24 24" fill="none">
      <path d="M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <circle cx="7.5" cy="17.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="17.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="size-5 text-[#c8a96e]" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 20 7v6c0 4.5-3.2 7.4-8 8-4.8-.6-8-3.5-8-8V7l8-4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" className="size-5 text-[#c8a96e]" viewBox="0 0 24 24" fill="none">
      <path d="m12 3 2.6 6.4L21 10.5l-5 4.3L17.3 21 12 17.8 6.7 21l1.3-6.2-5-4.3 6.4-1.1L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}
