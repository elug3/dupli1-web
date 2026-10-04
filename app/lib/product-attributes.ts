/**
 * Free-form parent `attributes` (dupli1 docs/product-attributes.md) as PDP
 * detail rows. Keys are not fixed (a jacket may say "fill", "Fill weight" or
 * "outer_fabric"), so every non-empty pair is shown, in the order received.
 */

export interface AttributeRow {
  /** Normalized key for a translated label: "fill-weight". */
  key: string;
  /** The key made readable, used when there is no translation: "Fill weight". */
  label: string;
  value: string;
}

/** "fillWeight" / "fill_weight" / "Fill Weight" → "fill-weight". */
export function attributeKey(raw: string): string {
  return raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * "fillWeight" / "fill_weight" → "Fill weight". Acronyms (RDS) and
 * non-Latin keys stay as written.
 */
export function attributeLabel(raw: string): string {
  const words = raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function attributeRows(attributes: Record<string, string> | undefined): AttributeRow[] {
  if (!attributes) return [];
  return Object.entries(attributes)
    .map(([raw, value]) => ({
      key: attributeKey(raw),
      label: attributeLabel(raw),
      value: typeof value === "string" ? value.trim() : "",
    }))
    .filter((row) => row.label && row.value);
}
