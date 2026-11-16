import { useEffect, useState } from "react";
import { Link } from "react-router";
import { type Bag, type BagSearchFilters, fetchBags, listingProductImage } from "~/lib/api";
import { brandDisplayName } from "~/lib/catalog";
import { useLanguage } from "~/lib/i18n";
import { SHELF_SIZE } from "~/lib/home-shelves";
import { useWishlist } from "~/lib/useWishlist";
import { PRODUCT_GRID_CLASS, ProductCard, ProductCardSkeleton } from "./product-card";

/**
 * The home page's repeated box: a heading, four products in the shared card
 * and one "view all" link to the full listing. Hidden when it has nothing to
 * show, so an empty or failed search leaves no hole.
 *
 * `queries` are searched as they are; `pick` chooses the products to show
 * from the answers (apply the gender mode and the order there). The answers
 * are kept, so changing `pick` re-picks without searching again.
 */
export function ProductShelf({
  title,
  body,
  to,
  queries,
  pick,
  enabled = true,
}: {
  title: string;
  body?: string;
  to: string;
  queries: readonly BagSearchFilters[];
  pick: (lists: Bag[][]) => Bag[];
  /** False while the mode is still unknown: skeletons, and no search yet. */
  enabled?: boolean;
}) {
  const { t, translateProductName } = useLanguage();
  const wishlist = useWishlist();
  const [lists, setLists] = useState<Bag[][] | null>(null);
  const queryKey = JSON.stringify(queries);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLists(null);
    Promise.all(
      (JSON.parse(queryKey) as BagSearchFilters[]).map((query) =>
        // One category failing must not blank the others.
        fetchBags(query).catch(() => [] as Bag[])
      )
    ).then((results) => {
      if (!cancelled) setLists(results);
    });
    return () => {
      cancelled = true;
    };
  }, [queryKey, enabled]);

  const bags = lists ? pick(lists) : null;
  if (bags?.length === 0) return null;

  return (
    <section className="px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-[2rem] md:leading-tight">{title}</h2>
            {body && <p className="mt-2 max-w-md text-small text-mute">{body}</p>}
          </div>
          <Link
            to={to}
            className="shrink-0 pb-1 text-small underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            {t("home.viewAll")} <span aria-hidden>→</span>
          </Link>
        </div>

        <div className={PRODUCT_GRID_CLASS}>
          {bags === null
            ? Array.from({ length: SHELF_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)
            : bags.map((bag, index) => (
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
      </div>
    </section>
  );
}
