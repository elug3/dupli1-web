/**
 * Physical size of a sellable SKU, as dupli1-product sends it on each variant
 * (`dimensions: { widthMm, heightMm, depthMm }`). Always millimeters; an axis
 * that does not apply (a flat wallet's depth) is omitted.
 */
export type ProductDimensions = {
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
};

export type DimensionAxis = "width" | "height" | "depth";

/** Keeps only positive, finite axes; null when none are left. */
export function normalizeDimensions(
  raw: ProductDimensions | null | undefined
): ProductDimensions | null {
  if (!raw) return null;
  const out: ProductDimensions = {};
  for (const key of ["widthMm", "heightMm", "depthMm"] as const) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** 340 → "34", 225 → "22.5": centimeters with at most one decimal. */
function mmToCm(mm: number): string {
  return String(Math.round(mm) / 10);
}

/**
 * Formats dimensions for the PDP in centimeters, each axis labeled because a
 * bag's width and depth are easy to confuse: `W 34 × H 22 × D 8 cm`.
 * `label` supplies the localized axis name. "" when nothing is known.
 */
export function formatDimensionsCm(
  raw: ProductDimensions | null | undefined,
  label: (axis: DimensionAxis) => string
): string {
  const dims = normalizeDimensions(raw);
  if (!dims) return "";
  const parts: string[] = [];
  if (dims.widthMm) parts.push(`${label("width")} ${mmToCm(dims.widthMm)}`);
  if (dims.heightMm) parts.push(`${label("height")} ${mmToCm(dims.heightMm)}`);
  if (dims.depthMm) parts.push(`${label("depth")} ${mmToCm(dims.depthMm)}`);
  return `${parts.join(" × ")} cm`;
}
