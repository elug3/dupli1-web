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

  return (
    <footer className="hidden border-t border-zinc-100 bg-white px-4 py-16 md:block md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-4 gap-12">
          {/* Brand */}
          <div className="col-span-1">
            <p
              data-brand-logo
              className="mb-3 text-2xl font-light tracking-[0.35em] uppercase text-zinc-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Dupli1
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              {t("footer.description")}
            </p>
          </div>

          {/* Shop */}
          <div>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-950">
              {t("footer.shop")}
            </p>
            <ul className="space-y-2">
              {VISIBLE_NAV_GROUPS.map(({ id, labelKey, to }) => (
                <li key={id}>
                  <NavLink
                    to={to}
                    className="text-xs text-zinc-400 transition hover:text-zinc-950"
                  >
                    {t(labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-950">
              {t("footer.services")}
            </p>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li><Link to="/category/product-type/handbags" className="hover:text-zinc-950 transition">{t("footer.styleConsultation")}</Link></li>
              <li><NavLink to={MY_ACCOUNT_ORDERS_PATH} className="hover:text-zinc-950 transition">{t("footer.orderHistory")}</NavLink></li>
              <li><NavLink to="/profile" end className="hover:text-zinc-950 transition">{t("footer.myAccount")}</NavLink></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-950">
              {t("footer.info")}
            </p>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li>{t("footer.shippingReturns")}</li>
              <li>{t("footer.authenticityGuarantee")}</li>
              <li>{t("footer.privacyPolicy")}</li>
              <li>{t("footer.termsConditions")}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-zinc-100 pt-8">
          <p className="text-[11px] text-zinc-300">{t("footer.rights")}</p>
          <ShippingNote className="text-[11px] text-zinc-400" />
          <p className="text-[11px] text-zinc-300">{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
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
