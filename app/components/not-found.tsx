import { Link } from "react-router";
import { useRequestHeaderOverlay } from "~/lib/header-overlay";
import { useLanguage } from "~/lib/i18n";

type NotFoundAction = {
  label: string;
  to: string;
};

type NotFoundPageProps = {
  /** Full-bleed photo of an empty plinth, with the text set on it. */
  photo?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryAction?: NotFoundAction;
  secondaryAction?: NotFoundAction;
};

export function NotFoundPage({
  photo = false,
  eyebrow = "404",
  title,
  description,
  primaryAction,
  secondaryAction,
}: NotFoundPageProps) {
  const { t } = useLanguage();
  // The plinth photo is light, so the header runs over it in ink.
  useRequestHeaderOverlay(photo ? "dark" : null);
  const resolvedTitle = title ?? t("notFound.title");
  const resolvedDescription = description ?? t("notFound.description");
  const resolvedPrimaryAction = primaryAction ?? {
    label: t("product.browseAllBags"),
    to: "/",
  };

  if (photo) {
    // The photo carries its own room for text: extra floor below the plinth
    // on mobile, the plain wall to its right on desktop.
    return (
      <main className="relative bg-ground">
        <picture>
          <source media="(min-width: 768px)" srcSet="/not-found/plinth-desktop.jpg" />
          <img
            src="/not-found/plinth-mobile.jpg"
            alt=""
            aria-hidden="true"
            className="block aspect-[1122/1922] w-full object-cover md:aspect-[16/9] md:max-h-svh md:min-h-[520px]"
          />
        </picture>
        <section className="absolute inset-x-0 bottom-[15%] flex flex-col items-center px-4 text-center md:inset-x-auto md:bottom-auto md:left-[52%] md:right-[8.33%] md:top-1/2 md:-translate-y-1/2">
          <h1 className="text-xl font-normal uppercase tracking-[0.22em] text-ink md:text-3xl">
            {resolvedTitle}
          </h1>
          <p className="mt-3 text-sm text-mute">{resolvedDescription}</p>
          <Link
            to={resolvedPrimaryAction.to}
            className="mt-7 inline-flex h-12 items-center justify-center bg-ink px-9 text-xs font-medium uppercase tracking-[0.18em] text-white transition duration-300 hover:bg-mute"
          >
            {resolvedPrimaryAction.label}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-[62vh] items-center justify-center px-4 py-16 text-center md:px-8">
      <section className="mx-auto max-w-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-mute">
          {eyebrow}
        </p>
        <h1
          className="mt-4 text-5xl font-light tracking-tight text-zinc-950 md:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {resolvedTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-zinc-400">
          {resolvedDescription}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={resolvedPrimaryAction.to}
            className="inline-flex h-12 items-center justify-center bg-zinc-950 px-8 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-zinc-800"
          >
            {resolvedPrimaryAction.label}
          </Link>
          {secondaryAction && (
            <Link
              to={secondaryAction.to}
              className="inline-flex h-12 items-center justify-center border border-zinc-200 px-8 text-xs font-semibold uppercase tracking-widest text-zinc-600 transition hover:border-zinc-950 hover:text-zinc-950"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
