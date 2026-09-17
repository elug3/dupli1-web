/**
 * Concierge inquiry links.
 *
 * Used where the storefront cannot transact on its own — most notably an
 * unpriced product, where we invite an inquiry instead of showing a dead
 * "unavailable" state until a manager sets the price.
 */

/** Same concierge inbox the cart assistance block points at. */
export const CONCIERGE_EMAIL = "concierge@dupli1.com";

/**
 * `mailto:` for the concierge with a pre-filled subject and body.
 *
 * Both are encoded with encodeURIComponent rather than URLSearchParams:
 * the latter encodes spaces as `+`, which mail clients paste literally
 * into the subject line.
 */
export function conciergeMailto(subject: string, body: string): string {
  return [
    `mailto:${CONCIERGE_EMAIL}`,
    `?subject=${encodeURIComponent(subject)}`,
    `&body=${encodeURIComponent(body)}`,
  ].join("");
}
