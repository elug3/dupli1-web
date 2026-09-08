import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "~/lib/bff-session.server";

/**
 * Public order-service settings (`shipping_fee_krw`). No auth.
 *
 * Local-dev only — production ALB forwards `/api/*` to the gateway, so the
 * browser hits dupli1-order at the same path. Registered before
 * `api/v1/orders/:id` so "settings" is not treated as an order id.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return proxyBackendApi("orders", request, "/api/v1/orders/settings", {
    noStore: true,
  });
}
