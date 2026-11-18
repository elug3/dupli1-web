/**
 * The home page's top image banner (backend docs/product-storefront-banners.md).
 *
 * Staff upload a banner in the console and show it or take it down by hand.
 * The product service answers `GET /api/v1/products/banners?placement=home_hero`
 * with the live ones in display order; the first is the one shown. With none,
 * the home page keeps its built-in video.
 */
import type { LanguageCode } from "./i18n";

export type BannerText = Partial<Record<LanguageCode, string>>;

export interface HomeBanner {
  id: string;
  imageUrl: string;
  /** Tall image for phones; without it phones crop `imageUrl`. */
  mobileImageUrl?: string;
  title: BannerText;
  linkUrl?: string;
  linkLabel: BannerText;
}

interface RawBanner {
  id?: string;
  placement?: string;
  image_url?: string;
  mobile_image_url?: string;
  title?: BannerText | null;
  link_url?: string;
  link_label?: BannerText | null;
  active?: boolean;
}

function isImageUrl(url: string): boolean {
  return /^https?:\/\//.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

/** A storefront path or an https URL; anything else is dropped, never rendered. */
export function safeBannerLink(url: string | undefined): string | undefined {
  const link = url?.trim();
  if (!link) return undefined;
  if (link.startsWith("https://")) return link;
  if (link.startsWith("/") && !link.startsWith("//") && !/[\s\\]/.test(link)) return link;
  return undefined;
}

function cleanText(raw: BannerText | null | undefined): BannerText {
  const out: BannerText = {};
  for (const lang of ["ko", "en", "zh"] as const) {
    const value = raw?.[lang]?.trim();
    if (value) out[lang] = value;
  }
  return out;
}

/** The banner to show from the service's answer, or null for the built-in video. */
export function pickHomeBanner(body: unknown): HomeBanner | null {
  const list = (body as { banners?: RawBanner[] } | null)?.banners;
  if (!Array.isArray(list)) return null;
  for (const raw of list) {
    if (!raw || raw.active === false) continue;
    if (raw.placement && raw.placement !== "home_hero") continue;
    const imageUrl = raw.image_url?.trim();
    if (!imageUrl || !isImageUrl(imageUrl)) continue;
    const mobile = raw.mobile_image_url?.trim();
    return {
      id: String(raw.id ?? ""),
      imageUrl,
      mobileImageUrl: mobile && isImageUrl(mobile) ? mobile : undefined,
      title: cleanText(raw.title),
      linkUrl: safeBannerLink(raw.link_url),
      linkLabel: cleanText(raw.link_label),
    };
  }
  return null;
}

/** Text in the shopper's language, falling back to Korean, then anything set. */
export function bannerText(text: BannerText, language: LanguageCode): string {
  return text[language] || text.ko || text.en || text.zh || "";
}
