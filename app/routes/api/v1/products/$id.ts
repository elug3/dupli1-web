import type { LoaderFunctionArgs } from "react-router";

import { proxyProductApi } from "~/lib/bff-session.server";

/**
 * Local-dev BFF passthrough for public product detail.
 * Production ALB forwards `/api/v1/products/{id}` to the gateway.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  return proxyProductApi(request, `/api/v1/products/${id}`, {
    noStore: true,
  });
}
