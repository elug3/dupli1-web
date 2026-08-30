import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

// Canonical human-SKU stock read — GET /api/v1/products/inventory/items/{sku}
export async function loader({ request, params }: LoaderFunctionArgs) {
  const sku = encodeURIComponent(params.sku ?? "");
  return proxyBackendApi(
    "products",
    request,
    `/api/v1/products/inventory/items/${sku}`,
    { noStore: true }
  );
}
