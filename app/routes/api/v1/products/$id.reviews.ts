import type { LoaderFunctionArgs } from "react-router";

import { proxyProductApi } from "~/lib/bff-session.server";

/**
 * Local-dev BFF passthrough for a product's public reviews (and, with
 * `/photos`, its photo strip). Production forwards
 * `/api/v1/products/{id}/reviews*` to the gateway.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  const url = new URL(request.url);
  const photos = url.pathname.endsWith("/photos") ? "/photos" : "";
  return proxyProductApi(request, `/api/v1/products/${id}/reviews${photos}${url.search}`, {
    noStore: true,
  });
}
