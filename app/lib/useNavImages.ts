import { useRouteLoaderData } from "react-router";

import type { NavImageMap } from "./nav";

/** Category photos filled at server startup and sent with the document. */
export function useNavImages(): NavImageMap | undefined {
  const data = useRouteLoaderData("root") as { navImages?: NavImageMap } | undefined;
  return data?.navImages;
}
