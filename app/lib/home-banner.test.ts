import { describe, expect, it } from "vitest";
import { bannerText, pickHomeBanner, safeBannerLink } from "./home-banner";

const base = {
  id: "b1",
  placement: "home_hero",
  image_url: "https://dupli1.com/product-images/banners/a.jpg",
  title: { ko: "겨울 컬렉션", en: "", zh: "" },
  link_url: "/category/product-type/handbags",
  link_label: { ko: "지금 쇼핑하기", en: "Shop now", zh: "" },
  active: true,
};

describe("pickHomeBanner", () => {
  it("takes the first live banner", () => {
    const b = pickHomeBanner({ banners: [base, { ...base, id: "b2" }] });
    expect(b?.id).toBe("b1");
    expect(b?.linkUrl).toBe("/category/product-type/handbags");
    expect(b?.title).toEqual({ ko: "겨울 컬렉션" });
    expect(b?.mobileImageUrl).toBeUndefined();
  });
  it("is null with no banners or a bad answer", () => {
    expect(pickHomeBanner({ banners: [] })).toBeNull();
    expect(pickHomeBanner(null)).toBeNull();
    expect(pickHomeBanner({ banners: "x" })).toBeNull();
  });
  it("skips hidden, other placements and unusable images", () => {
    const b = pickHomeBanner({
      banners: [
        { ...base, id: "off", active: false },
        { ...base, id: "other", placement: "category_top" },
        { ...base, id: "js", image_url: "javascript:alert(1)" },
        { ...base, id: "ok", mobile_image_url: "/product-images/banners/m.jpg" },
      ],
    });
    expect(b?.id).toBe("ok");
    expect(b?.mobileImageUrl).toBe("/product-images/banners/m.jpg");
  });
  it("drops an unsafe link but keeps the banner", () => {
    expect(pickHomeBanner({ banners: [{ ...base, link_url: "javascript:alert(1)" }] })?.linkUrl).toBeUndefined();
  });
});

describe("safeBannerLink", () => {
  it("allows storefront paths and https only", () => {
    expect(safeBannerLink("/women")).toBe("/women");
    expect(safeBannerLink("https://example.com/x")).toBe("https://example.com/x");
    expect(safeBannerLink("//evil.com")).toBeUndefined();
    expect(safeBannerLink("http://example.com")).toBeUndefined();
    expect(safeBannerLink("/a b")).toBeUndefined();
    expect(safeBannerLink("")).toBeUndefined();
  });
});

describe("bannerText", () => {
  it("falls back to Korean", () => {
    expect(bannerText({ ko: "겨울", en: "Winter" }, "en")).toBe("Winter");
    expect(bannerText({ ko: "겨울" }, "zh")).toBe("겨울");
    expect(bannerText({}, "en")).toBe("");
  });
});
