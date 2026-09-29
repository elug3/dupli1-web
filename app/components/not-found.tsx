import { Link } from "react-router";
import { useLanguage } from "~/lib/i18n";

type NotFoundAction = {
  label: string;
  to: string;
};

type NotFoundPageProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryAction?: NotFoundAction;
  secondaryAction?: NotFoundAction;
};

export function NotFoundPage({
  eyebrow = "404",
  title,
  description,
  primaryAction,
  secondaryAction,
}: NotFoundPageProps) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("notFound.title");
  const resolvedDescription = description ?? t("notFound.description");
  const resolvedPrimaryAction = primaryAction ?? {
    label: t("product.browseAllBags"),
    to: "/",
  };

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
