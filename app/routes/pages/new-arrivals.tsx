import { useEffect, useMemo, useState } from "react";
import { type Bag, fetchBags, listingProductImage } from "~/lib/api";
import { brandDisplayName } from "~/lib/catalog";
import { GENDER_MODES, GENDER_MODE_LABEL_KEYS, useGender } from "~/lib/gender";
import { NEW_ARRIVALS_SIZE, mergeNewest, newestQueries } from "~/lib/home-shelves";
import { useLanguage } from "~/lib/i18n";
import { useWishlist } from "~/lib/useWishlist";
import { GenderTabs } from "~/components/gender-tabs";
import { PRODUCT_GRID_CLASS, ProductCard, ProductCardSkeleton } from "~/components/product-card";

export function meta() {
  return [
    { title: "New Arrivals | Dupli1" },
    { name: "description", content: "The newest bags and jackets at Dupli1." },
  ];
}

/**
 * The newest products of every category, in the shopper's mode. The pills
 * change the mode here (and for the rest of the visit) without leaving.
 */
export default function NewArrivals() {
  const { t, translateProductName } = useLanguage();
  const { mode, ready, setMode } = useGender();
  const wishlist = useWishlist();
  const [lists, setLists] = useState<Bag[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      newestQueries(NEW_ARRIVALS_SIZE).map((query) => fetchBags(query).catch(() => [] as Bag[]))
    ).then((results) => {
      if (!cancelled) setLists(results);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bags = useMemo(
    () => (lists && ready ? mergeNewest(lists, mode, NEW_ARRIVALS_SIZE) : null),
    [lists, ready, mode]
  );

  return (
    <main className="bg-white">
      <GenderTabs active="new" />
      <div className="px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center md:mb-10">
            <h1 className="text-2xl md:text-[2rem] md:leading-tight">{t("home.newArrivalsTitle")}</h1>
            <p className="mx-auto mt-3 max-w-md text-small text-mute">{t("home.newArrivalsBody")}</p>
            <div className="mt-6 flex justify-center gap-2" role="group" aria-label={t("home.entryLabel")}>
              {GENDER_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={[
                    "inline-flex h-10 items-center rounded-full border px-5 text-small transition-colors duration-300 ease-lux",
                    mode === option ? "border-ink bg-ink text-white" : "border-rule hover:border-ink",
                  ].join(" ")}
                >
                  {t(GENDER_MODE_LABEL_KEYS[option])}
                </button>
              ))}
            </div>
          </div>

          {bags === null ? (
            <div className={PRODUCT_GRID_CLASS}>
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : bags.length === 0 ? (
            <p className="border border-zinc-100 bg-zinc-50 px-6 py-16 text-center text-sm text-zinc-500">
              {t("newArrivals.empty")}
            </p>
          ) : (
            <div className={PRODUCT_GRID_CLASS}>
              {bags.map((bag, index) => (
                <ProductCard
                  key={bag.id}
                  id={bag.id}
                  name={translateProductName(bag.id, bag.name)}
                  brand={brandDisplayName(bag.brand)}
                  image={listingProductImage(bag.category, bag.brand, bag.image)}
                  price={bag.price}
                  stock={bag.stock}
                  index={index}
                  wishlisted={wishlist.has(bag.id)}
                  wishlistBusy={wishlist.isBusy(bag.id)}
                  onToggleWishlist={() => void wishlist.toggle(bag.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
