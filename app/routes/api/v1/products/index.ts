import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { proxyProductApi } from "~/lib/bff-session.server";

/**
 * Local-dev BFF passthrough for the product search/create API.
 * In production the ALB routes `/api/*` straight to the gateway, so the
 * browser hits `dupli1-product` directly at the same path.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return proxyProductApi(request, "/api/v1/products", { noStore: true });
}

export async function action({ request }: ActionFunctionArgs) {
  return proxyProductApi(request, "/api/v1/products", {
    requireAuth: true,
  });
}
