import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  type DisplayProduct,
  productImage,
  searchProducts,
} from "~/lib/api";
import {
  type CategoryFacet,
  buildCategorySearchParams,
  categoryDisplayLabel,
  facetOptions,
  isCategoryFacet,
  productMatchesFacetValue,
} from "~/lib/catalog";
import { ProductPrice } from "~/components/product-price";
import { useLanguage } from "~/lib/i18n";
import { pushHistory } from "~/lib/history";

export function meta() {
  return [
    { title: "Shop Bags | Dupli1" },
    { name: "description", content: "Browse curated luxury handbags." },
  ];
}

export default function CategoryPage() {
  const { facet = "product-type", value } = useParams();
  const resolvedFacet = isCategoryFacet(facet) ? facet : "product-type";

  // A facet without a selected value renders a landing/index page listing the
  // available options. A facet with a value renders the filtered product grid.
  if (!value) {
    return <FacetLanding facet={resolvedFacet} />;
  }

  return <FacetResults facet={resolvedFacet} value={value} />;
}

// ── Shared layout pieces ─────────────────────────────────────────────────────

function CategoryShell({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        <nav className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
          <Link to="/" className="transition hover:text-zinc-950">
            {t("product.home")}
          </Link>
          <span>/</span>
          <span className="text-zinc-600">{title}</span>
        </nav>

        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c8a96e]">
              {t("home.categoryBags")}
            </p>
            <h1
              className="mt-2 text-4xl font-light tracking-tight text-zinc-950 md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h1>
          </div>
          {typeof count === "number" && (
            <p className="text-sm text-zinc-400">
              {count} {count === 1 ? t("cart.item") : t("cart.items")}
            </p>
          )}
        </div>

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

// ── Facet landing / index page ───────────────────────────────────────────────

interface FacetOptionCard {
  value: string;
  label: string;
  count: number;
  image: string;
}

function FacetLanding({ facet }: { facet: CategoryFacet }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const title = categoryDisplayLabel(facet, undefined, t);

  useEffect(() => {
    setLoading(true);
    searchProducts("bags")
      .then((data) => setProducts(data.results))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [facet]);

  const cards = useMemo<FacetOptionCard[]>(() => {
    return facetOptions(facet).map((value) => {
      const matches = products.filter((product) =>
        productMatchesFacetValue(product.details, facet, value)
      );
      const representative = matches[0];
      const image = representative
        ? productImage(
            representative.category,
            String(representative.details.Brand ?? ""),
            representative.image
          )
        : productImage("bags", "", undefined);

      return {
        value,
        label: categoryDisplayLabel(facet, value, t),
        count: matches.length,
        image,
      };
    });
  }, [facet, products, t]);

  return (
    <CategoryShell title={title}>
      {loading ? (
        <ProductSkeletonGrid />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5 md:gap-y-12">
          {cards.map((card) => (
            <Link
              key={card.value}
              to={`/category/${facet}/${card.value}`}
              className="group"
            >
              <div
                className="relative mb-3 overflow-hidden bg-zinc-50"
                style={{ paddingBottom: "110%" }}
              >
                <img
                  src={card.image}
                  alt={card.label}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p
                    className="text-lg font-light text-white md:text-xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {card.label}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
                    {card.count}{" "}
                    {card.count === 1 ? t("cart.item") : t("cart.items")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CategoryShell>
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
  const { t, translateProductName } = useLanguage();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const title = query
    ? t("search.resultsFor", { query })
    : categoryDisplayLabel(facet, value, t);

  useEffect(() => {
    setLoading(true);
    const params = buildCategorySearchParams(facet, value);
    if (query) params.query = query;
    searchProducts("bags", params)
      .then((data) => {
        setProducts(data.results);
        if (query) pushHistory(query, "bags");
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [facet, value, query]);

  return (
    <CategoryShell title={title} count={loading ? undefined : products.length}>
      {loading ? (
        <ProductSkeletonGrid />
      ) : products.length === 0 ? (
        <section className="rounded-xl border border-zinc-100 bg-zinc-50 px-6 py-16 text-center">
          <p className="text-sm text-zinc-500">{t("category.empty")}</p>
          <Link
            to="/"
            className="mt-6 inline-flex h-11 items-center bg-zinc-950 px-6 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
          >
            {t("product.browseAllBags")}
          </Link>
        </section>
      ) : (
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
                {product.details.Brand}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-zinc-950">
                {translateProductName(product.id, product.name)}
              </p>
              <ProductPrice price={product.price} />
            </Link>
          ))}
        </div>
      )}
    </CategoryShell>
  );
}
