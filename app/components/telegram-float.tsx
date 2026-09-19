import { useLanguage } from "../lib/i18n";
import { telegramContactUrl } from "../lib/contact";

/**
 * Routes that carry the floating Telegram button: the home page and every
 * category/brand landing page. Those are the browsing surfaces where a shopper
 * has a question but no order to reference yet; product, cart, checkout and
 * account pages keep their own bottom chrome (e.g. the product page's sticky
 * add-to-cart bar) uncovered.
 */
export function isTelegramFloatRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/category/");
}

/**
 * Floating Telegram chat button.
 *
 * Sits above the mobile safe area in the bottom-right corner, below the cookie
 * banner (z-[60]) so consent is never covered, and above page content.
 *
 * Mounted from `root.tsx` rather than from the page modules: the routed pages
 * render inside `PageTransition`, whose `animation: … both` leaves a
 * `translateY(0)` transform on the wrapper, and a transformed ancestor becomes
 * the containing block for `position: fixed` children — the button would
 * anchor to the bottom of the page instead of the viewport.
 */
export function TelegramFloat() {
  const { t } = useLanguage();
  const label = t("contact.telegram");

  return (
    <a
      href={telegramContactUrl()}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-[0_6px_20px_rgba(34,158,217,0.35)] transition hover:bg-[#1c8ec2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#229ED9] md:right-8 md:size-16"
    >
      <TelegramIcon />
    </a>
  );
}

function TelegramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-7 md:size-8"
      fill="currentColor"
    >
      {/* Paper plane: body + the folded left wing, in white on the blue disc. */}
      <path d="M21.6 3.2c.5-.2 1 .3.85.8l-4.3 15.6c-.16.56-.86.73-1.26.31l-3.6-3.72-2.36 2.4c-.35.36-.96.11-.96-.4v-3.45L21.6 3.2Z" />
      <path d="M9.32 12.9 2.63 10.6c-.56-.19-.6-.96-.07-1.2L21.6 3.2 9.32 12.9Z" />
    </svg>
  );
}
