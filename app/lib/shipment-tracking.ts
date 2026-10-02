/**
 * Parcel tracking for a shipped order.
 *
 * Order requires a carrier and tracking number on every ship and stores the
 * carrier as one of a fixed set of codes (elug3/dupli1
 * order/pkg/domain/shipment.go). The shopper needs a carrier name rather than
 * the code, and a way to the carrier's own tracking page; dupli1 does not
 * track parcels itself.
 */

/** Carrier codes order accepts at ship time, lower-case. */
export type CarrierCode = "cj" | "hanjin" | "lotte" | "logen" | "epost" | "other";

const CARRIER_LABEL_KEYS: Record<CarrierCode, string> = {
  cj: "tracking.carrier.cj",
  hanjin: "tracking.carrier.hanjin",
  lotte: "tracking.carrier.lotte",
  logen: "tracking.carrier.logen",
  epost: "tracking.carrier.epost",
  other: "tracking.carrier.other",
};

/**
 * Each carrier's public tracking page, keyed by the waybill number. `other`
 * has none: its carrier is free text, so there is no page to point at.
 */
const CARRIER_TRACKING_URLS: Partial<Record<CarrierCode, (waybill: string) => string>> = {
  cj: (n) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${n}`,
  hanjin: (n) =>
    `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${n}`,
  lotte: (n) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${n}`,
  logen: (n) => `https://www.ilogen.com/web/personal/trace/${n}`,
  epost: (n) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${n}`,
};

/** Order normalizes the code to lower case; older rows may not have been. */
export function normalizeCarrierCode(carrier: string | undefined): CarrierCode | null {
  const code = carrier?.trim().toLowerCase() ?? "";
  return code in CARRIER_LABEL_KEYS ? (code as CarrierCode) : null;
}

/**
 * The carrier as the shopper should read it: the translated name for a known
 * code, the manager's free-text name for `other`, and the stored string as is
 * for anything order wrote before carrier codes were enforced.
 */
export function carrierDisplayName(
  carrier: string | undefined,
  carrierNote: string | undefined,
  t: (key: string) => string
): string | undefined {
  const code = normalizeCarrierCode(carrier);
  if (code === "other") {
    return carrierNote?.trim() || t(CARRIER_LABEL_KEYS.other);
  }
  if (code) return t(CARRIER_LABEL_KEYS[code]);
  return carrier?.trim() || undefined;
}

/**
 * Carriers print waybill numbers with hyphens or spaces (`1234-5678-9012`);
 * their tracking pages want the digits alone. Returns null for anything that
 * is not a plain waybill number, so a mistyped value never becomes a link.
 */
export function waybillDigits(trackingNumber: string | undefined): string | null {
  const digits = trackingNumber?.replace(/[\s-]/g, "") ?? "";
  return /^[0-9]{6,20}$/.test(digits) ? digits : null;
}

/** The carrier's tracking page for this parcel, or null when there is none. */
export function carrierTrackingUrl(
  carrier: string | undefined,
  trackingNumber: string | undefined
): string | null {
  const code = normalizeCarrierCode(carrier);
  const build = code ? CARRIER_TRACKING_URLS[code] : undefined;
  const digits = waybillDigits(trackingNumber);
  if (!build || !digits) return null;
  return build(encodeURIComponent(digits));
}
