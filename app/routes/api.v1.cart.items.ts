import type { ActionFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return proxyBackendApi("cart", request, "/api/v1/cart/items", { requireAuth: true });
}
