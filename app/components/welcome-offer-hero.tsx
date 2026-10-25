import { useLanguage } from "../lib/i18n";

// Notches cut into both short edges of the ticket.
const TICKET_MASK =
  "radial-gradient(circle at 0 50%, transparent 13px, #000 14px) left / 51% 100% no-repeat, " +
  "radial-gradient(circle at 100% 50%, transparent 13px, #000 14px) right / 51% 100% no-repeat";

function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`absolute ${className}`}>
      <path
        d="M12 0v24M0 12h24M8.5 8.5l7 7M15.5 8.5l-7 7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Welcome-coupon hero above the sign-in form: a ticket illustration and the
 * first-purchase offer. The discount is a promotional code a manager
 * registers with `auto_issue: "user_registered"`; this only advertises it.
 */
export function WelcomeOfferHero({ onSignUp }: { onSignUp: () => void }) {
  const { t } = useLanguage();
  const offer = t("signupOffer.heroOffer");
  const [before, after = ""] = t("signupOffer.heroTitle").split("{offer}");

  return (
    <section aria-labelledby="welcome-offer-title" className="text-center">
      <div className="relative mx-auto h-44 w-72 md:h-48 md:w-80">
        <div className="absolute inset-x-10 bottom-1 h-5 rounded-[50%] bg-ground" />
        <div
          className="absolute left-9 right-5 top-7 h-28 -rotate-3 rounded-md bg-rule md:h-32"
          style={{ mask: TICKET_MASK, WebkitMask: TICKET_MASK }}
        />
        <div
          className="absolute left-5 right-9 top-9 flex h-28 -rotate-6 flex-col items-center justify-center rounded-md bg-ink text-white md:h-32"
          style={{ mask: TICKET_MASK, WebkitMask: TICKET_MASK }}
        >
          <span className="text-[1.75rem] font-medium leading-none tracking-[0.18em] md:text-3xl">
            {t("signupOffer.ticketWord")}
          </span>
          <span className="mt-3 border-t border-white/30 pt-2 text-caption font-medium uppercase tracking-[0.3em] text-white/80">
            {t("signupOffer.ticketOffer")}
          </span>
        </div>
        <Sparkle className="-left-2 top-14 size-6 text-ink" />
        <Sparkle className="right-0 top-0 size-7 text-mute" />
        <Sparkle className="-right-3 bottom-6 size-5 text-ink" />
      </div>

      <h2
        id="welcome-offer-title"
        className="mx-auto mt-6 max-w-sm text-xl font-normal leading-snug tracking-tight text-ink [word-break:keep-all] md:text-2xl"
      >
        <span className="block">{before.trim()}</span>
        <span className="font-medium underline decoration-1 underline-offset-[6px]">{offer}</span>
        {after}
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-small text-mute [word-break:keep-all]">
        {t("signupOffer.description")}
      </p>
      <button
        type="button"
        onClick={onSignUp}
        className="mx-auto mt-6 flex h-12 w-full max-w-sm items-center justify-center rounded-full bg-ink text-small font-medium text-white transition-colors duration-300 hover:bg-zinc-700"
      >
        {t("signupOffer.cta")}
      </button>
    </section>
  );
}
