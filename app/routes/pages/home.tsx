import { useEffect, useMemo } from "react";
import { Link, useLoaderData } from "react-router";
import { GenderTabs, NEW_ARRIVALS_PATH } from "~/components/gender-tabs";
import { ProductShelf } from "~/components/product-shelf";
import { type GenderMode, useGender, withGender } from "~/lib/gender";
import { type HomeBanner, bannerText } from "~/lib/home-banner";
import { loadHomeBanner } from "~/lib/home-banner.server";
import {
  SHELF_FETCH_LIMIT,
  SHELF_SIZE,
  homeCategoryBoxes,
  mergeNewest,
  newestQueries,
  pickShelf,
} from "~/lib/home-shelves";
import { useLanguage } from "~/lib/i18n";
import { VISIBLE_NAV_GROUPS, navItemLabel, visibleNavItems } from "~/lib/nav";
import { useNavShelves } from "~/lib/useNavShelves";

export function meta() {
  return [
    { title: "Dupli1 — Curated Luxury Bags" },
    { name: "description", content: "Authentic luxury bags from the world's most coveted brands." },
  ];
}

/** The live home banner, if staff are showing one (shared by `/women` and `/men`). */
export async function loader() {
  return { banner: await loadHomeBanner() };
}

const HOME_HERO_POSTER = "/heroes/home-banner.jpg";
const HOME_HERO_VIDEO =
  "https://video.wixstatic.com/video/e947e9_46c6e0d6219243f0bcd58882fb254882/1080p/mp4/file.mp4";

/**
 * The home page of a gender mode. Step one is the tab row (women, men, new
 * arrivals, all); step two is this page for the choice: new arrivals, then
 * one box per category we sell, each four products and a link to the listing.
 *
 * `/women` and `/men` pass `fixed` and are remembered; `/` shows the
 * remembered mode, or everything for a visitor who has not chosen.
 */
export function GenderHome({ fixed }: { fixed?: GenderMode }) {
  const { t } = useLanguage();
  const { mode: remembered, ready, setMode } = useGender();
  const mode = fixed ?? remembered;
  // On `/` the mode is only known once the remembered choice has been read.
  const known = fixed !== undefined || ready;

  useEffect(() => {
    if (fixed && ready && remembered !== fixed) setMode(fixed);
  }, [fixed, ready, remembered, setMode]);

  const shelves = useNavShelves();
  const boxes = useMemo(
    () => homeCategoryBoxes(VISIBLE_NAV_GROUPS, shelves, new Date().getMonth()),
    [shelves]
  );
  const newest = useMemo(() => newestQueries(SHELF_FETCH_LIMIT), []);
  const banner = useLoaderData<typeof loader>()?.banner ?? null;

  return (
    <main className="bg-white">
      {banner ? <BannerHero banner={banner} /> : <Hero mode={mode} />}
      <GenderTabs active={mode} />
      <ProductShelf
        title={t("home.newArrivalsTitle")}
        body={t("home.newArrivalsBody")}
        to={NEW_ARRIVALS_PATH}
        queries={newest}
        pick={(lists) => mergeNewest(lists, mode, SHELF_SIZE)}
        enabled={known}
      />
      {boxes.map((box) => (
        <ProductShelf
          key={box.id}
          title={navItemLabel(box.label, t)}
          to={withGender(box.to, mode)}
          queries={[box.query]}
          pick={(lists) => pickShelf(lists[0] ?? [], mode)}
          enabled={known}
        />
      ))}
      <BrandRow />
    </main>
  );
}

export default function Home() {
  return <GenderHome />;
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero({ mode }: { mode: GenderMode }) {
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
            to={withGender("/category/product-type/handbags", mode)}
            className="mt-4 text-small underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            {t("home.shopNow")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * A staff-uploaded image in place of the video: the phone image on narrow
 * screens when there is one, the text in the shopper's language (Korean when
 * that one is empty), and the whole image as the link when it has one.
 */
function BannerHero({ banner }: { banner: HomeBanner }) {
  const { t, language } = useLanguage();
  const title = bannerText(banner.title, language);
  const label = bannerText(banner.linkLabel, language);
  const link = banner.linkUrl;

  const picture = (
    <picture>
      {banner.mobileImageUrl && <source media="(min-width: 768px)" srcSet={banner.imageUrl} />}
      <img
        src={banner.mobileImageUrl ?? banner.imageUrl}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
    </picture>
  );
  const text = (title || (link && label)) && (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center bg-gradient-to-t from-black/35 to-transparent px-4 pb-10 pt-24 text-center text-white md:pb-14">
      {title && <h1 className="text-2xl md:text-[2rem] md:leading-tight">{title}</h1>}
      {link && label && <span className="mt-4 text-small underline underline-offset-4">{label}</span>}
    </div>
  );
  const frame = "relative block aspect-[4/5] w-full md:aspect-[5/2]";
  const linkCls = `${frame} transition-opacity hover:opacity-95`;

  return (
    <section
      className="relative w-full overflow-hidden bg-[#cfcfcf]"
      aria-label={title || t("home.heroAlt")}
      data-banner-id={banner.id}
    >
      {!link ? (
        <div className={frame}>
          {picture}
          {text}
        </div>
      ) : link.startsWith("/") ? (
        <Link to={link} className={linkCls}>
          {picture}
          {text}
        </Link>
      ) : (
        <a href={link} className={linkCls} rel="noopener">
          {picture}
          {text}
        </a>
      )}
    </section>
  );
}

// ── Brand row ──────────────────────────────────────────────────────────────

/** The houses as a line of names: type does the work the logo tiles did. */
function BrandRow() {
  const { t } = useLanguage();
  const shelves = useNavShelves();
  const brands = visibleNavItems(
    VISIBLE_NAV_GROUPS.find((g) => g.id === "brand")?.items ?? [],
    shelves
  );
  if (brands.length === 0) return null;

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
