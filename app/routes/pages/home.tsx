import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  type Bag,
  type BagSearchFilters,
  diversifyBagsByBrand,
  fetchBags,
  listingBagImage,
} from "~/lib/api";
import {
  FEATURED_BRAND_SLUGS,
  brandApiName,
  brandBlurbKey,
  brandDisplayName,
} from "~/lib/catalog";
import { useLanguage } from "~/lib/i18n";
import { NAV_GROUPS, VISIBLE_NAV_GROUPS, navItemLabel } from "~/lib/nav";
import { NavImage } from "~/components/nav-image";
import {
  PRODUCT_GRID_CLASS,
  ProductCard,
  ProductCardSkeleton,
} from "~/components/product-card";
import { useWishlist } from "~/lib/useWishlist";

export function meta() {
  return [
    { title: "Dupli1 — Curated Luxury Bags" },
    { name: "description", content: "Authentic luxury bags from the world's most coveted brands." },
  ];
}

const HOME_HERO_POSTER = "/heroes/home-banner.jpg";
const HOME_HERO_VIDEO =
  "https://video.wixstatic.com/video/e947e9_46c6e0d6219243f0bcd58882fb254882/1080p/mp4/file.mp4";

/** Products per hub: one row of the shared grid on desktop, two on phones. */
const HUB_SIZE = 4;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The featured house for the third hub, changing once a week so the page
 * does not look the same on every visit.
 */
function brandOfTheWeek(now = Date.now()) {
  return FEATURED_BRAND_SLUGS[Math.floor(now / WEEK_MS) % FEATURED_BRAND_SLUGS.length];
}

/**
 * One white page in seven blocks: the hero, the category tiles, then hubs
 * (an intro, four products, one button to the listing) with the brand row
 * between them. Every block below the hero ends in something to buy.
 */
export default function Home() {
  const { t } = useLanguage();
  const brandSlug = brandOfTheWeek();
  const blurbKey = brandBlurbKey(brandSlug);

  return (
    <main className="bg-white">
      <Hero />
      <CategoryTiles />
      <Hub
        title={t("home.newArrivalsTitle")}
        body={t("home.newArrivalsBody")}
        to="/category/product-type/handbags"
        query={{ sort: "newest", limit: 24 }}
      />
      <Hub
        title={t("home.bestSellersTitle")}
        body={t("home.bestSellersBody")}
        to="/category/product-type/handbags"
        query={{ sort: "views", limit: 24 }}
      />
      <BrandRow />
      <Hub
        title={brandDisplayName(brandSlug)}
        body={blurbKey ? t(blurbKey) : ""}
        to={`/category/brand/${brandSlug}`}
        query={{ brand: brandApiName(brandSlug), sort: "views", limit: HUB_SIZE }}
        mixBrands={false}
      />
    </main>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const { t } = useLanguage();

  return (
    <section className="relative w-full overflow-hidden bg-[#cfcfcf]" aria-label={t("home.heroAlt")}>
      <div className="relative aspect-[4/5] w-full md:aspect-[5/2]">
        <img
          src={HOME_HERO_POSTER}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HOME_HERO_POSTER}
        >
          <source src={HOME_HERO_VIDEO} type="video/mp4" />
        </video>

        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center bg-gradient-to-t from-black/35 to-transparent px-4 pb-10 pt-24 text-center text-white md:pb-14">
          <h1 className="text-2xl md:text-[2rem] md:leading-tight">
            {t("home.heroTitleLine1")} {t("home.heroTitleLine2")}
          </h1>
          <Link
            to="/category/product-type/handbags"
            className="mt-4 text-small underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            {t("home.shopNow")}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Category tiles ─────────────────────────────────────────────────────────

/**
 * Every item of every launched subject as a picture tile, then the styles as
 * a row of links. Reads the menu's tree, so wallets and padded jackets get
 * their own row of tiles the day they launch.
 */
function CategoryTiles() {
  const { t } = useLanguage();
  const subjects = VISIBLE_NAV_GROUPS.filter((g) => g.kind === "subject");
  const style = VISIBLE_NAV_GROUPS.find((g) => g.id === "style");

  return (
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("home.categoriesTitle")} />

        <div className="grid gap-12">
          {subjects.map((subject) => (
            <div key={subject.id} className="min-w-0">
              {subjects.length > 1 && (
                <h3 className="mb-4 text-small text-mute">{t(subject.labelKey)}</h3>
              )}
              <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                {subject.items.map((item) => (
                  <li key={item.to} className="w-[42vw] shrink-0 snap-start md:w-auto">
                    <Link to={item.to} className="group block">
                      <NavImage
                        to={item.to}
                        className="aspect-square transition-opacity duration-300 ease-lux group-hover:opacity-85"
                      />
                      <p className="mt-3 text-small">{navItemLabel(item, t)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {style && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-2 text-small text-mute">{t("home.shopByStyle")}</span>
            {style.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex h-10 items-center border border-rule px-4 text-small transition-colors duration-300 ease-lux hover:border-ink"
              >
                {navItemLabel(item, t)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Hub ────────────────────────────────────────────────────────────────────

/**
 * The home page's one repeated unit: a short intro, four products in the
 * shared card and one outlined button to the full listing. Hidden when the
 * catalog returns nothing, so an empty or failed query leaves no hole.
 */
function Hub({
  title,
  body,
  to,
  query,
  mixBrands = true,
}: {
  title: string;
  body: string;
  to: string;
  query: BagSearchFilters;
  /** Spread the four across brands (true) or keep the query's order. */
  mixBrands?: boolean;
}) {
  const { t, translateProductName } = useLanguage();
  const wishlist = useWishlist();
  const [bags, setBags] = useState<Bag[] | null>(null);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    fetchBags(JSON.parse(queryKey) as BagSearchFilters)
      .then((results) => {
        if (cancelled) return;
        setBags(mixBrands ? diversifyBagsByBrand(results, HUB_SIZE) : results.slice(0, HUB_SIZE));
      })
      .catch(() => {
        if (!cancelled) setBags([]);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, mixBrands]);

  if (bags?.length === 0) return null;

  return (
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={title} body={body} />

        <div className={PRODUCT_GRID_CLASS}>
          {bags === null
            ? Array.from({ length: HUB_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)
            : bags.map((bag, index) => (
                <ProductCard
                  key={bag.id}
                  id={bag.id}
                  name={translateProductName(bag.id, bag.name)}
                  brand={brandDisplayName(bag.brand)}
                  image={listingBagImage(bag.brand, bag.image)}
                  price={bag.price}
                  officialPrice={bag.officialPrice}
                  stock={bag.stock}
                  index={index}
                  wishlisted={wishlist.has(bag.id)}
                  wishlistBusy={wishlist.isBusy(bag.id)}
                  onToggleWishlist={() => void wishlist.toggle(bag.id)}
                />
              ))}
        </div>

        <div className="mt-10 flex justify-center md:mt-12">
          <Link
            to={to}
            className="inline-flex h-12 items-center border border-ink px-8 text-small transition-colors duration-300 ease-lux hover:bg-ink hover:text-white"
          >
            {t("home.viewAll")}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Brand row ──────────────────────────────────────────────────────────────

/** The houses as a line of names: type does the work the logo tiles did. */
function BrandRow() {
  const { t } = useLanguage();
  const brands = NAV_GROUPS.find((g) => g.id === "brand")?.items ?? [];

  return (
    <section className="border-y border-rule px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-5xl">
        <SectionHeading title={t("home.shopByBrand")} />
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4 md:gap-x-12 md:gap-y-6">
          {brands.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="text-lg transition-colors duration-300 ease-lux hover:text-mute md:text-xl"
              >
                {navItemLabel(item, t)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Shared ─────────────────────────────────────────────────────────────────

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-8 text-center md:mb-12">
      <h2 className="text-2xl md:text-[2rem] md:leading-tight">{title}</h2>
      {body && <p className="mx-auto mt-3 max-w-md text-small text-mute">{body}</p>}
    </div>
  );
}
