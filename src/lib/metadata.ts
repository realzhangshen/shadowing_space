import { locales, defaultLocale } from "@/i18n/config";
import { siteConfig } from "@/lib/siteConfig";

export function buildPageAlternates(locale: string, path: string) {
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] =
      l === defaultLocale ? `${siteConfig.url}${path}` : `${siteConfig.url}/${l}${path}`;
  }
  languages["x-default"] = `${siteConfig.url}${path}`;

  const canonical = locale === defaultLocale ? path : `/${locale}${path}`;
  const url =
    locale === defaultLocale ? `${siteConfig.url}${path}` : `${siteConfig.url}/${locale}${path}`;

  return {
    canonical,
    languages,
    url,
  };
}
