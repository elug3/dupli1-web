import { Link } from "react-router";

import { LISTING_IMAGE_SIZES } from "~/lib/api";
import { useLanguage } from "~/lib/i18n";
import { ProductPrice } from "./product-price";

/**
 * The one product card for every listing (home, category, brand pages):
 * square image on a pale ground, a wishlist heart, then brand, name and price
 * at one small size. No hover zoom and no badges over the photo.
 */
export function ProductCard({
  id,
  name,
  brand,
  image,
  price,
  officialPrice,
  stock,
  index,
  wishlisted,
  wishlistBusy,
  onToggleWishlist,
}: {
  id: string;
  /** Display name, already translated. */
  name: string;
  /** Display brand, e.g. "Louis Vuitton". */
  brand: string;
  image: string;
  price: number;
  officialPrice?: number;
  stock?: number;
  /** Position in the grid; the first row loads eagerly. */
  index: number;
  wishlisted: boolean;
  wishlistBusy: boolean;
  onToggleWishlist: () => void;
}) {
  const { t } = useLanguage();
  const lowStock = typeof stock === "number" && stock > 0 && stock <= 5;

  return (
    <div className="relative">
      <Link to={`/product/${id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-ground">
          <img
            src={image}
            alt={name}
            width={600}
            height={600}
            sizes={LISTING_IMAGE_SIZES}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 4 ? "high" : undefined}
            className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
          />
        </div>
        <div className="mt-3 pr-2">
          {brand && <p className="text-caption text-mute">{brand}</p>}
          <p className="text-small text-ink">{name}</p>
          <ProductPrice price={price} officialPrice={officialPrice} />
          {lowStock && <p className="mt-0.5 text-caption text-alert">{t("home.lowStock")}</p>}
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggleWishlist}
        disabled={wishlistBusy}
        aria-pressed={wishlisted}
        aria-label={wishlisted ? t("product.removeWishlist") : t("product.addWishlist")}
        className="absolute right-1 top-1 flex size-10 items-center justify-center text-ink transition-opacity duration-300 disabled:opacity-40"
      >
        <svg aria-hidden="true" className="size-[18px]" viewBox="0 0 24 24" fill={wishlisted ? "currentColor" : "none"}>
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
    </div>
  );
}

/** Loading placeholder with the card's exact geometry. */
export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square bg-ground" />
      <div className="mt-3 h-3 w-16 bg-ground" />
      <div className="mt-1.5 h-3.5 w-32 bg-ground" />
      <div className="mt-1.5 h-3.5 w-20 bg-ground" />
    </div>
  );
}

/** The one listing grid: 2 columns on phones, 4 from md, same gaps everywhere. */
export const PRODUCT_GRID_CLASS = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-y-12";
