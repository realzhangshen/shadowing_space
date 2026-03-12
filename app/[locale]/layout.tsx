import type { Metadata } from "next";
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
  "zh-Hans": "zh_CN",
  "zh-Hant": "zh_TW",
  ja: "ja_JP",
  ru: "ru_RU",
};

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

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
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteConfig.name,
    },
  };
}

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

  const tLayout = await getTranslations({ locale, namespace: "Layout" });

  return (
    <NextIntlClientProvider messages={messages}>
      <JsonLd data={webAppJsonLd} />
      <JsonLd data={webSiteJsonLd} />
      <div className="app-bg">
        <a className="skip-to-content" href="#main-content">
          {tLayout("skipToContent")}
        </a>
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="page-wrap">
          {children}
        </main>
      </div>
      <Analytics />
      <SpeedInsights />
    </NextIntlClientProvider>
  );
}
