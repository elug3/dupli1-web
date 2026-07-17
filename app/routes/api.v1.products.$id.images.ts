import type { ActionFunctionArgs } from "react-router";

import { proxyProductApi } from "../lib/bff-session.server";

/**
 * Local-dev BFF passthrough for multipart product image upload:
 * `POST /api/v1/products/{id}/images` (form field `image`).
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const id = encodeURIComponent(params.id ?? "");
  return proxyProductApi(request, `/api/v1/products/${id}/images`, {
    requireAuth: true,
  });
}
