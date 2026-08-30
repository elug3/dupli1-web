import type { ActionFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return proxyBackendApi("orders", request, "/api/v1/orders/checkout/sessions", {
    requireAuth: true,
  });
}
