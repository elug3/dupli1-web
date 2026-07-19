import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

// Stock reads are public on dupli1-product (`/api/v1/inventory/*`).
// The standalone inventory service is gone — same paths, product upstream.
export async function loader({ request, params }: LoaderFunctionArgs) {
  const sku = encodeURIComponent(params.sku ?? "");
  return proxyBackendApi("products", request, `/api/v1/inventory/${sku}`, {
    noStore: true,
  });
}
