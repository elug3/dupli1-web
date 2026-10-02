import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import "./app.css";
import { CookieBanner } from "./components/cookie-banner";
import { NotFoundPage } from "./components/not-found";
import {
  isTelegramFloatRoute,
  storefrontContext,
  TelegramFloat,
} from "./components/telegram-float";
import { ShippingNote, SiteHeader } from "./components/site-header";
import { MY_ACCOUNT_ORDERS_PATH } from "./lib/account";
import { LanguageProvider, useLanguage } from "./lib/i18n";
import { VISIBLE_NAV_GROUPS } from "./lib/nav";
import { recordBrowserVisit } from "./lib/visit-beacon";

export const links = () => [
  // Pretendard (Latin + Hangul, all text): the dynamic-subset build fetches
  // only the Hangul blocks a page uses.
  { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  },
  // Noto Sans SC: Chinese, which Pretendard does not cover.
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Unique-visitor count for the admin reports: once per page load, and the
  // beacon itself skips the call after the first one of the KST day.
  useEffect(() => {
    recordBrowserVisit();
  }, []);

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white text-zinc-950">
        <SiteHeader />
        <MainOffset>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </MainOffset>
        <Footer />
        <TelegramChat />
        <CookieBanner />
      </div>
    </LanguageProvider>
  );
}

/** Floating Telegram chat, on the home and category pages only. */
function TelegramChat() {
  const { pathname } = useLocation();
  const { language } = useLanguage();

  if (!isTelegramFloatRoute(pathname)) return null;
  return <TelegramFloat context={storefrontContext(pathname, language)} />;
}

/**
 * Pushes pages below the fixed header. The home hero runs underneath it
 * instead, so the header can sit transparent over the image.
 */
function MainOffset({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <div className={pathname === "/" ? "" : "pt-(--header-h)"}>{children}</div>;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-page-transition">
      {children}
    </div>
  );
}

function Footer() {
  const { t } = useLanguage();
  const linkClass = "transition hover:text-ink";

  return (
    <footer className="border-t border-rule bg-white px-4 pt-10 pb-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="md:grid md:grid-cols-4 md:gap-12">
          <div className="mb-8 md:mb-0">
            <p
              data-brand-logo
              className="mb-3 text-2xl font-light tracking-[0.35em] uppercase text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Dupli1
            </p>
            <p className="text-caption text-mute">{t("footer.description")}</p>
          </div>

          <FooterColumn title={t("footer.shop")}>
            {VISIBLE_NAV_GROUPS.map(({ id, labelKey, to }) => (
              <li key={id}>
                <NavLink to={to} className={linkClass}>
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t("footer.services")}>
            <li><Link to="/category/product-type/handbags" className={linkClass}>{t("footer.styleConsultation")}</Link></li>
            <li><NavLink to={MY_ACCOUNT_ORDERS_PATH} className={linkClass}>{t("footer.orderHistory")}</NavLink></li>
            <li><NavLink to="/profile" end className={linkClass}>{t("footer.myAccount")}</NavLink></li>
          </FooterColumn>

          <FooterColumn title={t("footer.info")}>
            <li>{t("footer.shippingReturns")}</li>
            <li>{t("footer.authenticityGuarantee")}</li>
            <li>{t("footer.privacyPolicy")}</li>
            <li>{t("footer.termsConditions")}</li>
          </FooterColumn>
        </div>

        <div className="mt-10 grid gap-2 text-caption text-mute md:mt-12 md:flex md:items-center md:justify-between md:border-t md:border-rule md:pt-8">
          <p>{t("footer.rights")}</p>
          <ShippingNote />
          <p>{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * A footer column: always open from md, a tap-to-open row on phones so the
 * footer does not become a long list under every page.
 */
function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-rule md:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-4 text-left text-small md:pointer-events-none md:mb-4 md:py-0"
      >
        <span>{title}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className={`size-4 transition-transform duration-300 ease-lux md:hidden ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </button>
      <ul className={`space-y-2 pb-5 text-small text-mute md:block md:pb-0 ${open ? "block" : "hidden"}`}>
        {children}
      </ul>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const { t } = useLanguage();
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }

    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? t("notFound.description") : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-24">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && <pre className="w-full overflow-x-auto p-4"><code>{stack}</code></pre>}
    </main>
  );
}
