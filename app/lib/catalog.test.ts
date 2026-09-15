import { describe, expect, it } from "vitest";

import {
  brandApiName,
  brandToSlug,
  buildCategorySearchParams,
  isFeaturedBrandSlug,
} from "./catalog";

describe("Bottega Veneta catalog wiring", () => {
  it("maps display and API names to the brand slug", () => {
    expect(brandToSlug("Bottega Veneta")).toBe("bottega-veneta");
    expect(brandApiName("bottega-veneta")).toBe("Bottega Veneta");
  });

  it("filters search by the upstream brand name", () => {
    expect(buildCategorySearchParams("brand", "bottega-veneta")).toEqual({
      brand: "Bottega Veneta",
    });
  });

  it("uses the featured brand page", () => {
    expect(isFeaturedBrandSlug("bottega-veneta")).toBe(true);
  });
});
