import type { ActionFunctionArgs } from "react-router";

import { proxyBackendApi } from "~/lib/bff-session.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const sku = encodeURIComponent(params.sku ?? "");
  return proxyBackendApi("cart", request, `/api/v1/cart/items/${sku}`, {
    requireAuth: true,
  });
}
