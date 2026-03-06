import { locales } from "@/i18n/config";
import { siteConfig } from "@/lib/siteConfig";

export function buildPageAlternates(locale: string, path: string) {
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] =
      l === "en" ? `${siteConfig.url}${path}` : `${siteConfig.url}/${l}${path}`;
  }
  languages["x-default"] = `${siteConfig.url}${path}`;

  const canonical = locale === "en" ? path : `/${locale}${path}`;
  const url =
    locale === "en" ? `${siteConfig.url}${path}` : `${siteConfig.url}/${locale}${path}`;

  return {
    canonical,
    languages,
    url,
  };
}
