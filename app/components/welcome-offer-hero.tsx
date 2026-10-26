import { useLanguage } from "../lib/i18n";

// Where the tear-off stub starts, as a share of the ticket's width.
const STUB_AT = "70%";

// Half-circle notches top and bottom where the stub tears off.
const TICKET_MASK =
  `radial-gradient(circle at ${STUB_AT} 0, transparent 9px, #000 10px) top / 100% 51% no-repeat, ` +
  `radial-gradient(circle at ${STUB_AT} 100%, transparent 9px, #000 10px) bottom / 100% 51% no-repeat`;

// Bar widths for the decorative barcode on the stub.
const BARS = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2];

function Barcode({ className }: { className: string }) {
  let x = 0;
  const rects = BARS.map((w, i) => {
    const rect = i % 2 === 0 ? <rect key={i} x={x} width={w} height="24" /> : null;
    x += w;
    return rect;
  });
  return (
    <svg viewBox={`0 0 ${x} 24`} preserveAspectRatio="none" aria-hidden="true" className={className}>
      <g fill="currentColor">{rects}</g>
    </svg>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-mute md:text-[10px]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-caption font-medium text-ink md:text-small">{value}</p>
    </div>
  );
}

function TrainTicket() {
  const { t } = useLanguage();
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex w-full max-w-md rounded-md bg-ground text-left text-ink"
      style={{ mask: TICKET_MASK, WebkitMask: TICKET_MASK }}
    >
      <div className="min-w-0 p-4 md:p-5" style={{ width: STUB_AT }}>
        <div className="flex items-center justify-between gap-2 text-[9px] font-medium uppercase tracking-[0.2em] md:text-[10px]">
          <span>Dupli1</span>
          <span className="text-mute">{t("signupOffer.ticketWord")}</span>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.15em] text-mute md:text-[10px]">
              {t("signupOffer.ticketFrom")}
            </p>
            <p className="mt-0.5 truncate text-base font-medium md:text-lg">
              {t("signupOffer.ticketFromValue")}
            </p>
          </div>
          <div className="mb-2.5 flex flex-1 items-center">
            <span className="size-1.5 rounded-full border border-ink" />
            <span className="h-px flex-1 bg-ink" />
            <svg viewBox="0 0 8 8" className="size-2"><path d="M0 0l8 4-8 4z" fill="currentColor" /></svg>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[9px] uppercase tracking-[0.15em] text-mute md:text-[10px]">
              {t("signupOffer.ticketTo")}
            </p>
            <p className="mt-0.5 truncate text-base font-medium md:text-lg">
              {t("signupOffer.ticketToValue")}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-rule pt-3">
          <Field label={t("signupOffer.ticketBenefit")} value={t("signupOffer.ticketOffer")} />
          <Field label={t("signupOffer.ticketValid")} value={t("signupOffer.ticketValidValue")} />
          <Field label={t("signupOffer.ticketIssued")} value={t("signupOffer.ticketIssuedValue")} />
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 border-l border-dashed border-mute/60 px-2 py-4">
        <p className="text-3xl font-medium leading-none tracking-tight md:text-4xl">15%</p>
        <p className="text-[9px] font-medium uppercase tracking-[0.25em] md:text-[10px]">
          {t("signupOffer.ticketStub")}
        </p>
        <Barcode className="mt-1 h-6 w-16 text-ink md:w-20" />
      </div>
    </div>
  );
}

/**
 * Welcome-offer hero above the sign-in form: a train-ticket illustration and the
 * first-purchase offer. The discount is a promotional code a manager
 * registers with `auto_issue: "user_registered"`; this only advertises it.
 */
export function WelcomeOfferHero({ onSignUp }: { onSignUp: () => void }) {
  const { t } = useLanguage();
  const offer = t("signupOffer.heroOffer");
  const [before, after = ""] = t("signupOffer.heroTitle").split("{offer}");

  return (
    <section aria-labelledby="welcome-offer-title" className="text-center">
      <TrainTicket />

      <h2
        id="welcome-offer-title"
        className="mx-auto mt-8 max-w-sm text-xl font-normal leading-snug tracking-tight text-ink [word-break:keep-all] md:text-2xl"
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
