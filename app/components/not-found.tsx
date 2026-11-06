import type { ReactNode } from "react";
import { Link } from "react-router";
import { useRequestHeaderOverlay } from "~/lib/header-overlay";
import { useLanguage } from "~/lib/i18n";

export const errorPrimaryButton =
  "inline-flex h-12 items-center justify-center bg-ink px-7 md:px-9 text-xs font-medium uppercase tracking-[0.18em] text-white transition duration-300 hover:bg-mute";
export const errorSecondaryButton =
  "inline-flex h-12 items-center justify-center border border-ink px-7 md:px-9 text-xs font-medium uppercase tracking-[0.18em] text-ink transition duration-300 hover:bg-ink hover:text-white";

/**
 * The full-bleed empty plinth photo with a headline, one line and actions set
 * on it. Every storefront error page uses it. The photo carries its own room
 * for text: extra floor below the plinth on mobile, the plain wall to its
 * right on desktop. It is light, so the header runs over it in ink.
 */
/** Photos under public/not-found/, each as `<name>-mobile.jpg` and `<name>-desktop.jpg`. */
export type ErrorPhoto = "plinth";

export function ErrorPhotoPage({
  image = "plinth",
  title,
  description,
  children,
}: {
  image?: ErrorPhoto;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  useRequestHeaderOverlay("dark");

  return (
    <main className="relative bg-ground">
      <picture>
        <source media="(min-width: 768px)" srcSet={`/not-found/${image}-desktop.jpg`} />
        <img
          src={`/not-found/${image}-mobile.jpg`}
          alt=""
          aria-hidden="true"
          className="block aspect-[1122/1922] w-full object-cover md:aspect-[16/9] md:max-h-svh md:min-h-[520px]"
        />
      </picture>
      <section className="absolute inset-x-0 bottom-[15%] flex flex-col items-center px-4 text-center md:inset-x-auto md:bottom-auto md:left-[52%] md:right-[8.33%] md:top-1/2 md:-translate-y-1/2">
        <h1 className="text-xl font-normal uppercase tracking-[0.22em] text-ink md:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-3 text-sm text-mute">{description}</p>}
        {children && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{children}</div>
        )}
      </section>
    </main>
  );
}

type NotFoundAction = {
  label: string;
  to: string;
};

export function NotFoundPage({
  title,
  description,
  primaryAction,
}: {
  title?: string;
  description?: string;
  primaryAction?: NotFoundAction;
}) {
  const { t } = useLanguage();
  const action = primaryAction ?? { label: t("product.browseAllBags"), to: "/" };

  return (
    <ErrorPhotoPage
      title={title ?? t("notFound.title")}
      description={description ?? t("notFound.description")}
    >
      <Link to={action.to} className={errorPrimaryButton}>
        {action.label}
      </Link>
    </ErrorPhotoPage>
  );
}
