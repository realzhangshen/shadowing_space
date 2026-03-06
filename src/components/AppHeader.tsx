"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";

const localeLabels: Record<Locale, { short: string; full: string }> = {
  en: { short: "EN", full: "English" },
  "zh-Hans": { short: "简体", full: "简体中文" },
  "zh-Hant": { short: "繁體", full: "繁體中文" },
  ja: { short: "日本語", full: "日本語" },
  ru: { short: "RU", full: "Русский" },
};

export function AppHeader(): JSX.Element {
  const t = useTranslations("AppHeader");
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const links = [
    { href: "/" as const, label: t("navHome") },
    { href: "/dashboard" as const, label: t("navDashboard") },
    { href: "/guide" as const, label: t("navGuide") },
  ];

  const onLocaleSelect = (nextLocale: Locale) => {
    setOpen(false);
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header className="topbar">
      <div>
        <Link href="/" className="eyebrow-link">
          <p className="eyebrow">{t("siteName")}</p>
        </Link>
        <h1>{t("siteTagline")}</h1>
      </div>

      <nav className="topnav" aria-label="Main navigation">
        {links.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "nav-link active" : "nav-link"}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="locale-switcher" ref={popoverRef}>
          <button
            className="nav-link locale-trigger"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("language")}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <svg className="locale-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {localeLabels[currentLocale].short}
            <span className="locale-chevron" />
          </button>
          {open && (
            <ul className="locale-menu" role="listbox" aria-label={t("language")}>
              {locales.map((l) => (
                <li key={l}>
                  <button
                    className={`locale-option${l === currentLocale ? " active" : ""}`}
                    role="option"
                    aria-selected={l === currentLocale}
                    onClick={() => onLocaleSelect(l)}
                  >
                    <span className="locale-check">
                      {l === currentLocale ? "✓" : ""}
                    </span>
                    {localeLabels[l].full}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </header>
  );
}
