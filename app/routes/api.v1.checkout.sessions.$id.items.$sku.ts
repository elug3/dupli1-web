import type { ActionFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  const sku = encodeURIComponent(params.sku ?? "");
  return proxyBackendApi(
    "checkout",
    request,
    `/api/v1/checkout/sessions/${id}/items/${sku}`,
    { requireAuth: true }
  );
}
