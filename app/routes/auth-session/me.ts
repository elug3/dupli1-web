import type { LoaderFunctionArgs } from "react-router";

import { handleMe } from "~/lib/bff-session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return handleMe(request);
}
