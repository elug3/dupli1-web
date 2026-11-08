import { ListboxSelect } from "~/components/listbox-select";
import type { DisplayProduct } from "~/lib/api";
import { useLanguage } from "~/lib/i18n";
import {
  type FilterKey,
  type FilterOption,
  type ListingFilters,
  LISTING_SORTS,
  SORT_LABEL_KEYS,
  filterOptions,
  hasActiveFilters,
} from "~/lib/listing-filters";

const LABEL_KEYS: Record<FilterKey, string> = {
  size: "filter.size",
  gender: "filter.gender",
  brand: "filter.brand",
};

/**
 * Dropdowns over a category listing: the filters this page can use, then
 * sort. A filter with nothing to narrow is not drawn.
 */
export function ListingFilterBar({
  products,
  filters,
  keys,
  onFilter,
  onReset,
}: {
  /** The whole listing, before filters. */
  products: readonly DisplayProduct[];
  filters: ListingFilters;
  /** Filters this page offers (no brand filter on a brand page, say). */
  keys: readonly FilterKey[];
  onFilter: (key: FilterKey | "sort", value: string | null) => void;
  onReset: () => void;
}) {
  const { t } = useLanguage();
  const shown = keys
    .map((key) => ({ key, options: filterOptions(products, filters, key) }))
    .filter(({ options }) => options.length > 0);

  const label = (key: FilterKey, option: FilterOption) =>
    key === "gender" ? t(option.label) : option.label;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shown.map(({ key, options }) => {
          const current = options.find((option) => option.value === filters[key]);
          return (
            <ListboxSelect
              key={key}
              label={t(LABEL_KEYS[key])}
              value={filters[key] ?? ""}
              selectedContent={
                <span className="truncate text-small">
                  {current ? label(key, current) : t("filter.all")}
                </span>
              }
              options={[
                { value: "", content: <span className="text-small">{t("filter.all")}</span> },
                ...options.map((option) => ({
                  value: option.value,
                  disabled: option.count === 0 && option.value !== filters[key],
                  content: (
                    <span className="flex justify-between gap-3 text-small">
                      <span>{label(key, option)}</span>
                      <span className="text-mute">{option.count}</span>
                    </span>
                  ),
                })),
              ]}
              onChange={(value) => onFilter(key, value || null)}
            />
          );
        })}
        <div className="col-start-2 md:col-start-4">
          <ListboxSelect
            label={t("filter.sort")}
            value={filters.sort}
            selectedContent={
              <span className="truncate text-small">{t(SORT_LABEL_KEYS[filters.sort])}</span>
            }
            options={LISTING_SORTS.map((sort) => ({
              value: sort,
              content: <span className="text-small">{t(SORT_LABEL_KEYS[sort])}</span>,
            }))}
            onChange={(value) => onFilter("sort", value)}
          />
        </div>
      </div>
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-small text-mute underline underline-offset-4 hover:text-ink"
        >
          {t("filter.reset")}
        </button>
      )}
    </div>
  );
}
