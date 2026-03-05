import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteConfig";
import { locales, defaultLocale } from "@/i18n/config";

const publicPaths = ["/", "/guide"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of publicPaths) {
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      const prefix = locale === defaultLocale ? "" : `/${locale}`;
      languages[locale] = `${siteConfig.url}${prefix}${path === "/" ? "" : path}`;
    }
    languages["x-default"] = `${siteConfig.url}${path === "/" ? "" : path}`;

    entries.push({
      url: `${siteConfig.url}${path === "/" ? "" : path}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: path === "/" ? 1.0 : 0.8,
      alternates: { languages },
    });
  }

  return entries;
}
