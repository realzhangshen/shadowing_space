import type { Viewport } from "next";
import { getLocale } from "next-intl/server";
import { siteConfig } from "@/lib/siteConfig";
import "./globals.css";

type RootLayoutProps = {
  children: React.ReactNode;
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: RootLayoutProps): Promise<JSX.Element> {
  const locale = await getLocale();

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
      </head>
      <body>{children}</body>
    </html>
  );
}
