import type { LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "~/lib/bff-session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return proxyBackendApi("orders", request, "/api/v1/orders", {
    requireAuth: true,
    noStore: true,
  });
}
