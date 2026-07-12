import { useEffect, useRef, useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "./app.css";
import { CookieBanner } from "./components/cookie-banner";
import { NotFoundPage } from "./components/not-found";
import { LanguageProvider, useLanguage, type LanguageCode } from "./lib/i18n";
import { useCart } from "./lib/useCart";

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
        <AnnouncementBar />
        <TopNav />
        {/* announcement 32px + logo row 56px = 88px mobile; + nav row ~36px = 124px desktop */}
        <div className="pt-[5.5rem] md:pt-[7.75rem]">
          <Outlet />
        </div>
        <Footer />
        <CookieBanner />
      </div>
    </LanguageProvider>
  );
}

function AnnouncementBar() {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center bg-zinc-950 px-4 py-2">
      <p className="text-center text-[10px] tracking-[0.18em] text-white/70 uppercase">
        {t("announcement.freeShipping")}&ensp;·&ensp;{t("announcement.code")}&ensp;
        <span className="font-medium text-[#c8a96e] tracking-widest">SUMMER30</span>
        &ensp;—&ensp;{t("announcement.discount")}
      </p>
    </div>
  );
}

const desktopNavLinks = [
  {
    id: "productType",
    labelKey: "nav.productType",
    to: "/category/product-type/handbags",
    items: [
      { labelKey: "home.categoryBags", to: "/category/product-type/handbags" },
      { labelKey: "category.totes", to: "/category/product-type/totes" },
      { labelKey: "category.shoulderBags", to: "/category/product-type/shoulder-bags" },
      { labelKey: "category.crossbody", to: "/category/product-type/crossbody" },
      { labelKey: "category.miniBags", to: "/category/product-type/mini-bags" },
    ],
  },
  {
    id: "brand",
    labelKey: "nav.brand",
    to: "/category/brand/louis-vuitton",
    items: [
      { label: "Louis Vuitton", to: "/category/brand/louis-vuitton", image: "/brands/louis-vuitton.svg" },
      { label: "Miu Miu", to: "/category/brand/miu-miu", image: "/brands/miu-miu.svg" },
      { label: "Balenciaga", to: "/category/brand/balenciaga", image: "/brands/balenciaga.svg" },
      { label: "Hermès", to: "/category/brand/hermes", image: "/brands/hermes.svg" },
    ],
  },
  {
    id: "style",
    labelKey: "nav.style",
    to: "/category/style",
    items: [
      { labelKey: "category.casual", to: "/category/style/casual" },
      { labelKey: "category.evening", to: "/category/style/evening" },
      { labelKey: "category.business", to: "/category/style/business" },
      { labelKey: "category.weekend", to: "/category/style/weekend" },
      { labelKey: "category.statement", to: "/category/style/statement" },
    ],
  },
  {
    id: "family",
    labelKey: "nav.family",
    to: "/category/family",
    items: [
      { labelKey: "category.women", to: "/category/family/women" },
      { labelKey: "category.men", to: "/category/family/men" },
      { labelKey: "category.kids", to: "/category/family/kids" },
      { labelKey: "category.unisex", to: "/category/family/unisex" },
    ],
  },
];

const MOBILE_MENU_ANIM_MS = 280;

function TopNav() {
  const { t } = useLanguage();
  const { count } = useCart();
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const closeMenuTimeoutRef = useRef<number | null>(null);

  const openMobileMenu = () => {
    if (closeMenuTimeoutRef.current) {
      clearTimeout(closeMenuTimeoutRef.current);
      closeMenuTimeoutRef.current = null;
    }
    setMobileMenuVisible(true);
    setMobileMenuOpen(true);
  };

  const closeMobileMenu = () => {
    if (closeMenuTimeoutRef.current) {
      clearTimeout(closeMenuTimeoutRef.current);
    }
    setMobileMenuOpen(false);
    closeMenuTimeoutRef.current = window.setTimeout(() => {
      setMobileMenuVisible(false);
      closeMenuTimeoutRef.current = null;
    }, MOBILE_MENU_ANIM_MS);
  };

  const toggleMobileMenu = () => {
    if (mobileMenuOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  };

  useEffect(() => {
    if (!mobileMenuVisible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (closeMenuTimeoutRef.current) {
        clearTimeout(closeMenuTimeoutRef.current);
        closeMenuTimeoutRef.current = null;
      }
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuVisible]);

  return (
    <header
      className="fixed inset-x-0 top-8 z-40 bg-white"
      onMouseLeave={() => setActiveNav(null)}
    >
      {/* Row 1 — Logo (center) + Icons (right) */}
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10">
        <div className="flex justify-start">
          <button
            type="button"
            className="rounded p-2 text-zinc-400 transition-colors duration-200 hover:text-zinc-950 active:scale-95 md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={toggleMobileMenu}
          >
            <span
              className={[
                "block transition-transform duration-300 ease-out",
                mobileMenuOpen ? "rotate-90" : "rotate-0",
              ].join(" ")}
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </span>
          </button>
        </div>

        <NavLink
          to="/"
          data-brand-logo
          className="justify-self-center text-sm font-medium uppercase tracking-[0.4em] text-zinc-950 transition hover:opacity-70"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dupli1
        </NavLink>

        <div className="flex justify-end gap-0.5">
          <LanguageSelector />
          <NavLink
            to="/cart"
            aria-label={t("nav.shoppingBag")}
            className="relative rounded p-2 text-zinc-400 transition hover:text-zinc-950"
          >
            <BagIcon />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center bg-zinc-950 text-[9px] font-semibold text-white">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/profile"
            aria-label={t("nav.profile")}
            className="rounded p-2 text-zinc-400 transition hover:text-zinc-950"
          >
            <ProfileIcon />
          </NavLink>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileMenuVisible && (
        <>
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            className={[
              "fixed inset-0 top-[5.5rem] z-30 bg-black/25 backdrop-blur-[1px] md:hidden",
              mobileMenuOpen ? "animate-mobile-menu-overlay-in" : "animate-mobile-menu-overlay-out",
            ].join(" ")}
            onClick={closeMobileMenu}
          />
          <nav
            id="mobile-nav-menu"
            aria-label={t("nav.main")}
            className={[
              "absolute inset-x-0 top-full z-40 max-h-[calc(100vh-5.5rem)] overflow-y-auto border-b border-zinc-100 bg-white shadow-[0_18px_40px_-24px_rgba(9,9,11,0.35)] md:hidden",
              mobileMenuOpen ? "animate-mobile-menu-panel-in" : "animate-mobile-menu-panel-out",
            ].join(" ")}
          >
            <div className="mx-auto max-w-7xl px-6 py-5">
              {desktopNavLinks.map(({ id, labelKey, to, items }, sectionIndex) => (
                <div
                  key={id}
                  className="animate-mobile-menu-item-in border-b border-zinc-100 py-4 last:border-b-0"
                  style={{ animationDelay: `${80 + sectionIndex * 55}ms` }}
                >
                  <NavLink
                    to={to}
                    onClick={closeMobileMenu}
                    className="mb-3 block py-1 text-sm font-bold uppercase tracking-[0.15em] text-zinc-950 transition-colors duration-200 active:text-zinc-600"
                  >
                    {t(labelKey)}
                  </NavLink>
                  <ul className="space-y-1">
                    {items.map((item) => {
                      const label = "labelKey" in item ? t(item.labelKey) : item.label;
                      return (
                        <li key={label}>
                          <NavLink
                            to={item.to}
                            onClick={closeMobileMenu}
                            className="block py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 transition-colors duration-200 hover:text-zinc-950 active:text-zinc-950"
                          >
                            {label}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Row 2 — Nav links below logo (desktop only) */}
      <nav
        aria-label={t("nav.main")}
        className="hidden border-b border-zinc-100 md:flex items-center justify-center gap-7 pb-3"
      >
        {desktopNavLinks.map(({ id, labelKey, to }) => (
          <NavLink
            key={id}
            to={to}
            onMouseEnter={() => setActiveNav(id)}
            className={({ isActive }) =>
              [
                "whitespace-nowrap text-[11px] uppercase tracking-[0.15em] transition-colors",
                isActive || activeNav === id ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-950",
              ].join(" ")
            }
          >
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Mega dropdown — half viewport width, centered */}
      {activeNav && (() => {
        const activeGroup = desktopNavLinks.find((n) => n.id === activeNav);
        const isBrand = activeNav === "brand";
        return (
          <div className="absolute inset-x-0 flex justify-center border-b border-zinc-100 bg-white shadow-md">
            <div className="w-[50vw] px-10 py-8">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-300">
                {activeGroup ? t(activeGroup.labelKey) : ""}
              </p>
              <div className={isBrand ? "grid grid-cols-4 gap-4" : "grid grid-cols-4 gap-x-6 gap-y-3"}>
                {activeGroup?.items.map((item) => {
                  const label = "labelKey" in item ? t(item.labelKey) : item.label;
                  return (
                  isBrand && "image" in item ? (
                    <NavLink
                      key={label}
                      to={item.to}
                      onClick={() => setActiveNav(null)}
                      aria-label={label}
                      className="group flex items-center justify-center border border-zinc-100 bg-zinc-50 p-4 transition hover:border-zinc-300"
                    >
                      <img
                        src={(item as { image: string }).image}
                        alt={label}
                        className="h-7 w-auto object-contain opacity-60 transition group-hover:opacity-100"
                      />
                    </NavLink>
                  ) : (
                    <NavLink
                      key={label}
                      to={item.to}
                      onClick={() => setActiveNav(null)}
                      className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 transition hover:text-zinc-950 py-1"
                    >
                      {label}
                    </NavLink>
                  )
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </header>
  );
}

function LanguageSelector() {
  const { language, languages, setLanguage, t } = useLanguage();

  return (
    <label className="mr-1 hidden items-center gap-1 rounded p-1 text-zinc-400 transition hover:text-zinc-950 sm:flex">
      <span className="sr-only">{t("language.label")}</span>
      <GlobeIcon />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        aria-label={t("language.label")}
        className="cursor-pointer bg-transparent text-[10px] font-semibold uppercase tracking-[0.12em] outline-none"
      >
        {languages.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
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
              {desktopNavLinks.map(({ id, labelKey, to }) => (
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
              <li><NavLink to="/history" className="hover:text-zinc-950 transition">{t("footer.orderHistory")}</NavLink></li>
              <li><NavLink to="/profile" className="hover:text-zinc-950 transition">{t("footer.myAccount")}</NavLink></li>
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
          <p className="text-[11px] text-zinc-300">{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="m20 20-4.35-4.35M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 1 0 2.35-5.65M4 5v5h5m3-2v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 8h12l-1 13H7L6 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.25 2.45 3.35 5.45 3.35 9S14.25 18.55 12 21c-2.25-2.45-3.35-5.45-3.35-9S9.75 5.45 12 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
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
