import type { LoaderFunctionArgs } from "react-router";

import { proxyProductApi } from "~/lib/bff-session.server";

/**
 * Local-dev BFF passthrough for product recommendations.
 * Production ALB forwards `/api/v1/products/{id}/recommendations` to the gateway.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const qs = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return proxyProductApi(request, `/api/v1/products/${id}/recommendations${qs}`, {
    noStore: true,
  });
}
