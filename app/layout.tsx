import type { Viewport } from "next";
import localFont from "next/font/local";
import { getLocale } from "next-intl/server";
import { siteConfig } from "@/lib/siteConfig";
import "./globals.css";

// Self-hosted WOFF2 files live in app/fonts/ (see app/fonts/README.md). This
// keeps the build independent of fonts.googleapis.com and avoids a runtime
// CDN hop. CJK text falls back to the platform's system font via globals.css.
const inter = localFont({
  src: [
    {
      path: "./fonts/inter-latin-wght-normal.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "./fonts/inter-cyrillic-wght-normal.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    {
      path: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
      style: "normal",
      weight: "100 800",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

type RootLayoutProps = {
  children: React.ReactNode;
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: RootLayoutProps): Promise<JSX.Element> {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
