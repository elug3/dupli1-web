import { supportedCategories } from "~/lib/product-upstream.server";

export async function loader() {
  return Response.json({ categories: supportedCategories() });
}
