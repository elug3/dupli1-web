/**
 * Customer-facing contact channels.
 *
 * Telegram is the storefront's live chat channel: shoppers tap the floating
 * button on home/category pages and land in a direct chat. The handle is a
 * plain constant rather than an env var because the build is static (the
 * Dockerfile bakes the client bundle), so a build-time variable would only
 * look configurable at deploy time.
 */
export const TELEGRAM_CONTACT_HANDLE = "Dupli1212";

/**
 * Builds the `https://t.me/...` deep link for a Telegram handle.
 *
 * Accepts the handle in any of the shapes an operator is likely to paste —
 * `dupli1`, `@dupli1`, `t.me/dupli1`, or a full `https://t.me/dupli1` URL —
 * so a copy/paste with the `@` still produces a working link instead of
 * `https://t.me/@dupli1`, which Telegram rejects.
 */
export function telegramContactUrl(
  handle: string = TELEGRAM_CONTACT_HANDLE
): string {
  const trimmed = handle.trim();
  const withoutOrigin = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.)?(?:t|telegram)\.me\//i, "");
  const username = withoutOrigin.replace(/^@+/, "").replace(/\/+$/, "");

  return `https://t.me/${username}`;
}
