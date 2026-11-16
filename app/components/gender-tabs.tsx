import { Link } from "react-router";
import { GENDER_MODES, GENDER_MODE_LABEL_KEYS, type GenderMode, genderHomePath, useGender } from "~/lib/gender";
import { useLanguage } from "~/lib/i18n";

/** Where the new arrivals of every category are listed. */
export const NEW_ARRIVALS_PATH = "/new";

/**
 * The storefront's first step: women, men, new arrivals, or everything.
 * Women / men / all are modes, remembered for the next visit; new arrivals is
 * a shelf and leaves the remembered mode as it is.
 */
export function GenderTabs({ active }: { active: GenderMode | "new" }) {
  const { t } = useLanguage();
  const { setMode } = useGender();

  const tabClass = (on: boolean) =>
    [
      "inline-flex h-14 items-center border-b px-1 text-base transition-colors duration-300 ease-lux md:text-lg",
      on ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink",
    ].join(" ");

  const gender = (mode: GenderMode) => (
    <li key={mode}>
      <Link
        to={genderHomePath(mode)}
        onClick={() => setMode(mode)}
        aria-current={active === mode ? "page" : undefined}
        className={tabClass(active === mode)}
      >
        {t(GENDER_MODE_LABEL_KEYS[mode])}
      </Link>
    </li>
  );

  return (
    <nav aria-label={t("home.entryLabel")} className="border-b border-rule px-4 md:px-8">
      <ul className="mx-auto flex max-w-7xl items-center justify-center gap-7 md:gap-12">
        {GENDER_MODES.filter((mode) => mode !== "all").map(gender)}
        <li>
          <Link
            to={NEW_ARRIVALS_PATH}
            aria-current={active === "new" ? "page" : undefined}
            className={tabClass(active === "new")}
          >
            {t("home.newArrivalsTitle")}
          </Link>
        </li>
        {gender("all")}
      </ul>
    </nav>
  );
}
