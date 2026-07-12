import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { proxyBackendApi } from "../lib/bff-session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return proxyBackendApi("cart", request, "/api/v1/cart", { requireAuth: true });
}

export async function action({ request }: ActionFunctionArgs) {
  return proxyBackendApi("cart", request, "/api/v1/cart", { requireAuth: true });
}
