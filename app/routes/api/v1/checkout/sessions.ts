import type { ActionFunctionArgs } from "react-router";

import { proxyBackendApi } from "~/lib/bff-session.server";

export async function action({ request }: ActionFunctionArgs) {
  return proxyBackendApi("checkout", request, "/api/v1/checkout/sessions", {
    requireAuth: true,
  });
}
