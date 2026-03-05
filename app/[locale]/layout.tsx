import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppHeader } from "@/components/AppHeader";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/siteConfig";
import { locales } from "@/i18n/config";
import type { Locale } from "@/i18n/config";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const localeToOg: Record<Locale, string> = {
  en: "en_US",
  zh: "zh_CN",
  ja: "ja_JP",
};

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const alternateLanguages: Record<string, string> = {};
  for (const l of locales) {
    alternateLanguages[l] = l === "en" ? siteConfig.url : `${siteConfig.url}/${l}`;
  }
  alternateLanguages["x-default"] = siteConfig.url;

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    description: t("homeDescription"),
    keywords: [...siteConfig.keywords],
    authors: [{ name: siteConfig.author }],
    applicationName: siteConfig.name,
    openGraph: {
      type: "website",
      locale: localeToOg[locale as Locale] ?? "en_US",
      siteName: siteConfig.name,
      title: siteConfig.name,
      description: t("homeDescription"),
      url: siteConfig.url,
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.name,
      description: t("homeDescription"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    alternates: {
      languages: alternateLanguages,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteConfig.name,
    },
  };
}

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<JSX.Element> {
  const { locale } = await params;

  if (!hasLocale(locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    inLanguage: locale,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "YouTube-based shadowing practice",
      "Real-time waveform recording",
      "Side-by-side audio comparison",
      "Manual and auto practice modes",
      "Adjustable playback speed",
      "Progress tracking",
      "Local-first — all data in browser IndexedDB",
    ],
  };

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: locale,
  };

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
        <JsonLd data={webAppJsonLd} />
        <JsonLd data={webSiteJsonLd} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <div className="app-bg">
            <AppHeader />
            <main className="page-wrap">{children}</main>
          </div>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
