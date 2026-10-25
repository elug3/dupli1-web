import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "../lib/i18n";

// Per tab, so a shopper who closes it is not asked again on every visit to
// /login this session, but a later visit still sees the offer.
const STORAGE_KEY = "dupli1_signup_offer_dismissed";

/**
 * Bottom pop-up on /login inviting new customers to sign up for the
 * first-purchase discount. The discount itself is a promotional code a
 * manager registers with `auto_issue: "user_registered"`; this only
 * advertises it.
 */
export function SignupOfferBanner({ onSignUp }: { onSignUp: () => void }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      // Storage blocked: show it; dismissing still hides it for this page.
    }
    setMounted(true);
    if (dismissed) return;
    // Mount hidden, then show on the next frame so the slide-up runs.
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore: hidden for this page either way.
    }
    setVisible(false);
  }

  // Portalled to <body>: the page-transition wrapper keeps a transform, which
  // would pin a `fixed` element to the page instead of the viewport.
  if (!mounted) return null;
  return createPortal(
    <aside
      aria-labelledby="signup-offer-title"
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-white transition-transform duration-300 ease-[var(--ease-lux)] ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-5 pt-5 md:flex-row md:items-center md:justify-between md:gap-10 md:px-[8.33%] md:py-6">
        <div className="min-w-0 pr-10 md:pr-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-mute">
            {t("signupOffer.eyebrow")}
          </p>
          <p
            id="signup-offer-title"
            className="mt-1.5 text-lg font-normal tracking-tight text-ink [word-break:keep-all] md:text-xl"
          >
            {t("signupOffer.title")}
          </p>
          <p className="mt-1 text-small text-mute">{t("signupOffer.description")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismiss();
            onSignUp();
          }}
          className="h-11 shrink-0 rounded-full bg-ink px-7 text-small font-medium text-white transition-colors duration-300 hover:bg-zinc-700 md:mr-6"
        >
          {t("signupOffer.cta")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("signupOffer.close")}
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center text-mute transition-colors duration-300 hover:text-ink md:right-4 md:top-1/2 md:-translate-y-1/2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </aside>,
    document.body,
  );
}
