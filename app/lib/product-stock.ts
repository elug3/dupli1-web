/** PDP / cart stock resolution for always-tracked SKUs (PR #94 / elug3/dupli1#206). */

export type ProductStockFields = {
  availableQty?: number;
  inStock?: boolean;
  sku?: string;
  skuId?: string;
};

/** Prefer embedded `availableQty`; fall back to boolean `inStock`; else poll inventory. */
export function resolveEmbeddedStock(
  product: Pick<ProductStockFields, "availableQty" | "inStock">
): number | null {
  if (typeof product.availableQty === "number") {
    return product.availableQty;
  }
  if (product.inStock === true) {
    return 1;
  }
  if (product.inStock === false) {
    return 0;
  }
  return null;
}

/** Parent product id alone is not sellable — require a real variant sku / skuId. */
export function hasSellableVariant(
  product: Pick<ProductStockFields, "sku" | "skuId">
): boolean {
  return Boolean(product.skuId || product.sku?.trim());
}

/** Always-tracked: missing/zero available ⇒ out of stock (not "assume available"). */
export function isProductInStock(
  product: Pick<ProductStockFields, "sku" | "skuId">,
  availableStock: number | null
): boolean {
  return hasSellableVariant(product) && availableStock !== null && availableStock > 0;
}

/** Inventory API body → sellable units (quantity − reserved, floored at 0). */
export function inventoryAvailableFromBody(body: {
  quantity: number;
  reserved: number;
}): number {
  return Math.max(0, body.quantity - body.reserved);
}
