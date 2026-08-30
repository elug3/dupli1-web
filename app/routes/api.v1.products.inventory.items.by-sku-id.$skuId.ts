import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

// Canonical SkuID stock read — GET /api/v1/products/inventory/items/by-sku-id/{skuId}
export async function loader({ request, params }: LoaderFunctionArgs) {
  const skuId = encodeURIComponent(params.skuId ?? "");
  return proxyBackendApi(
    "products",
    request,
    `/api/v1/products/inventory/items/by-sku-id/${skuId}`,
    { noStore: true }
  );
}
