/**
 * Customer-facing contact channels.
 *
 * Telegram is the storefront's live chat channel: shoppers tap the floating
 * button on home/category pages and land in a chat with the consultation bot.
 * The handle is a plain constant rather than an env var because the build is
 * static (the Dockerfile bakes the client bundle), so a build-time variable
 * would only look configurable at deploy time.
 *
 * The bot is `@dupli1_support_bot` — a bot, not the human `@Dupli1212` account,
 * because Telegram requires every bot username to end in `bot`. See the backend
 * spec: elug3/dupli1 docs/support-telegram-bot.md.
 */
export const TELEGRAM_CONTACT_HANDLE = "dupli1_support_bot";

/** Where the shopper was when they reached for help. */
export type ContactSurface = "home" | "category" | "product";

/**
 * ContactContext travels to the bot in the deep link, so a consultation opens
 * knowing what the shopper was looking at.
 *
 * It is a hint, never an identity and never a permission: anyone can type any
 * `?start=` payload, so the bot stores it and shows it to staff rather than
 * trusting it for anything.
 */
export type ContactContext = {
  surface: ContactSurface;
  /** Category facet+value or product id, already slug-shaped. */
  ref?: string;
  /** The language the storefront was being read in. */
  language?: string;
};

const SURFACE_CODES: Record<ContactSurface, string> = {
  home: "h",
  category: "c",
  product: "p",
};

/**
 * Telegram caps a `?start=` payload at 64 characters and accepts only
 * `A-Z a-z 0-9 _ -`. Anything longer or stranger is not delivered, so the
 * encoder trims rather than hands Telegram something it will drop.
 */
const MAX_START_PAYLOAD = 64;

/** Fields are joined with `_`; slugs use `-`, so the two never collide. */
const FIELD_SEPARATOR = "_";

/** Strips whatever Telegram would refuse from one field. */
function sanitizeField(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9-]/g, "");
}

/**
 * Encodes where a shopper came from as a `?start=` payload.
 *
 * Shape: `<surface>_<ref>_<language>`, e.g. `c_b-louis-vuitton_ko`. The ref is
 * dropped — rather than truncated — when the whole thing would exceed
 * Telegram's limit: a cut-off reference points at the wrong product, which is
 * worse than no reference at all.
 *
 * Returns "" when there is nothing worth sending, so the caller emits a plain
 * `t.me/<bot>` link instead of an empty `?start=`.
 */
export function telegramStartPayload(context?: ContactContext): string {
  if (!context) return "";

  const surface = SURFACE_CODES[context.surface];
  if (!surface) return "";

  const language = sanitizeField(context.language ?? "");
  const ref = sanitizeField(context.ref ?? "");

  const withRef = [surface, ref, language].filter(Boolean).join(FIELD_SEPARATOR);
  if (withRef.length <= MAX_START_PAYLOAD) return withRef;

  return [surface, language].filter(Boolean).join(FIELD_SEPARATOR);
}

/**
 * Builds the `https://t.me/...` link for the consultation bot.
 *
 * `handle` accepts any shape an operator is likely to paste — `dupli1`,
 * `@dupli1`, `t.me/dupli1`, or a full `https://t.me/dupli1` URL — so a
 * copy/paste with the `@` still produces a working link instead of
 * `https://t.me/@dupli1`, which Telegram rejects.
 */
export function telegramContactUrl(
  options: { handle?: string; context?: ContactContext } = {}
): string {
  const handle = options.handle ?? TELEGRAM_CONTACT_HANDLE;
  const withoutOrigin = handle
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.)?(?:t|telegram)\.me\//i, "");
  const username = withoutOrigin.replace(/^@+/, "").replace(/\/+$/, "");

  const payload = telegramStartPayload(options.context);
  return payload
    ? `https://t.me/${username}?start=${payload}`
    : `https://t.me/${username}`;
}
