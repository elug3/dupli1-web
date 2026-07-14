import type { ActionFunctionArgs } from "react-router";

import { proxyProductApi } from "../lib/bff-session.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const id = params.id ?? "";
  if (!id) {
    return Response.json({ error: "missing product id" }, { status: 400 });
  }

  return proxyProductApi(
    request,
    `/api/v1/products/${encodeURIComponent(id)}/images`,
    { requireAuth: true }
  );
}
