import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shadowing Lab",
  description: "YouTube-based English shadowing practice app"
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <div className="app-bg">
          <AppHeader />
          <main className="page-wrap">{children}</main>
        </div>
      </body>
    </html>
  );
}
