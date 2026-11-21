import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addToWishlist,
  createProduct,
  listWishlist,
  removeFromWishlist,
  uploadProductImage,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

const wishlistCases: [string, () => Promise<unknown>, string][] = [
  ["listWishlist", () => listWishlist(), "Failed to load wishlist"],
  ["addToWishlist", () => addToWishlist("p1"), "Failed to add to wishlist"],
  [
    "removeFromWishlist",
    () => removeFromWishlist("p1"),
    "Failed to remove from wishlist",
  ],
];

describe("wishlist error messages", () => {
  for (const [name, call, fallback] of wishlistCases) {
    it(`${name} falls back to "${fallback}" on a non-JSON failure`, async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("<html/>", { status: 500 })));
      await expect(call()).rejects.toThrow(new Error(fallback));
    });

    it(`${name} surfaces the body error`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ error: "server said no" }), { status: 400 }))
      );
      await expect(call()).rejects.toThrow(new Error("server said no"));
    });
  }
});

describe("inline readers left alone (empty error means fallback)", () => {
  const emptyError = () =>
    vi.fn(async () => new Response(JSON.stringify({ error: "" }), { status: 400 }));

  it("createProduct keeps 'Failed to create product' for {error:\"\"}", async () => {
    vi.stubGlobal("fetch", emptyError());
    await expect(createProduct("bags", { Name: "x" })).rejects.toThrow(new Error("Failed to create product"));
  });

  it("uploadProductImage keeps 'Image upload failed' for {error:\"\"}", async () => {
    vi.stubGlobal("fetch", emptyError());
    await expect(
      uploadProductImage("p1", new File(["x"], "a.png"))
    ).rejects.toThrow(new Error("Image upload failed"));
  });
});
