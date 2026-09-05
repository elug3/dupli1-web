import type { ActionFunctionArgs } from "react-router";

import { proxyBackendApi } from "~/lib/bff-session.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const skuId = encodeURIComponent(params.skuId ?? "");
  return proxyBackendApi(
    "cart",
    request,
    `/api/v1/cart/items/by-sku-id/${skuId}`,
    { requireAuth: true }
  );
}
