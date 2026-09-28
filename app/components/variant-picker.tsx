import type { ProductVariant } from "~/lib/api";
import { useLanguage } from "~/lib/i18n";
import {
  isCombinationAvailable,
  pickVariant,
  swatchColor,
  variantColors,
  variantSizes,
} from "~/lib/product-variants";

type VariantPickerProps = {
  variants: ProductVariant[];
  selected: ProductVariant | undefined;
  onSelect: (variant: ProductVariant) => void;
};

/**
 * Color swatches and size pills for the PDP. A value with no stock left in
 * the current combination stays pickable (the page then offers the stock
 * inquiry instead of the bag button) but is struck through.
 */
export function VariantPicker({ variants, selected, onSelect }: VariantPickerProps) {
  const { t, translateValue } = useLanguage();
  const colors = variantColors(variants);
  const sizes = variantSizes(variants);
  if (colors.length === 0 && sizes.length === 0) return null;

  const pick = (choice: { color?: string; size?: string }) => {
    const next = pickVariant(variants, selected, choice);
    if (next && next !== selected) onSelect(next);
  };

  return (
    <div className="flex flex-col gap-5">
      {colors.length > 0 && (
        <fieldset>
          <legend className="text-xs text-zinc-950">
            <span className="font-semibold">{t("product.color")}</span>
            {selected?.color && (
              <span className="ml-2 text-zinc-500">{translateValue("color", selected.color)}</span>
            )}
          </legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {colors.map((color) => {
              const active = selected?.color === color;
              const available = isCombinationAvailable(variants, color, undefined);
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${translateValue("color", color)}${available ? "" : ` · ${t("product.variantSoldOut")}`}`}
                  title={translateValue("color", color)}
                  onClick={() => pick({ color })}
                  className={[
                    "relative flex size-9 items-center justify-center rounded-full transition",
                    active ? "ring-1 ring-zinc-950 ring-offset-2" : "hover:ring-1 hover:ring-zinc-300 hover:ring-offset-2",
                  ].join(" ")}
                >
                  <Swatch color={color} className="size-7" />
                  {!available && <SoldOutSlash />}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset>
          <legend className="text-xs text-zinc-950">
            <span className="font-semibold">{t("product.size")}</span>
            {selected?.size && <span className="ml-2 text-zinc-500">{selected.size}</span>}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((size) => {
              const active = selected?.size === size;
              const exists = variants.some((v) => v.size === size && v.color === selected?.color);
              const available = isCombinationAvailable(variants, exists ? selected?.color : undefined, size);
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${size}${available ? "" : ` · ${t("product.variantSoldOut")}`}`}
                  onClick={() => pick({ size })}
                  className={[
                    "h-10 min-w-12 rounded-md border px-4 text-xs font-semibold uppercase transition",
                    active
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : available
                        ? "border-zinc-200 text-zinc-950 hover:border-zinc-950"
                        : "border-zinc-100 text-zinc-300 line-through",
                  ].join(" ")}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

/**
 * Compact row of the available colors for the collapsed mobile sheet's head.
 * Tapping it opens the sheet to the full picker.
 */
export function VariantColorDots({
  variants,
  onClick,
}: {
  variants: ProductVariant[];
  onClick?: () => void;
}) {
  const { t } = useLanguage();
  const colors = variantColors(variants);
  if (colors.length < 2) return null;
  const shown = colors.slice(0, 4);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("product.chooseColor", { count: colors.length })}
      className="flex shrink-0 items-center gap-1.5"
    >
      {shown.map((color) => (
        <Swatch key={color} color={color} className="size-3" />
      ))}
      {colors.length > shown.length && (
        <span className="text-[10px] leading-none text-zinc-950">+{colors.length - shown.length}</span>
      )}
    </button>
  );
}

function Swatch({ color, className }: { color: string; className: string }) {
  const fill = swatchColor(color);
  return (
    <span
      aria-hidden="true"
      className={`${className} block shrink-0 rounded-full border border-zinc-200`}
      style={
        fill
          ? { backgroundColor: fill }
          : // Unknown name: a neutral split swatch rather than a wrong color.
            { background: "linear-gradient(135deg, #f4f4f5 50%, #d4d4d8 50%)" }
      }
    />
  );
}

function SoldOutSlash() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-1 rounded-full bg-[linear-gradient(to_top_right,transparent_calc(50%-0.75px),#71717a_calc(50%-0.75px),#71717a_calc(50%+0.75px),transparent_calc(50%+0.75px))]"
    />
  );
}
