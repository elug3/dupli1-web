import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { handleSessionGatewayProxy } from "~/lib/bff-session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return handleSessionGatewayProxy(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handleSessionGatewayProxy(request);
}
