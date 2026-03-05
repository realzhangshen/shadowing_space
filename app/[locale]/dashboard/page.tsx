import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HistoryClient } from "@/features/history/HistoryClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("dashboardTitle"),
    description: t("dashboardDescription"),
    robots: { index: false, follow: false },
  };
}

export default function DashboardPage(): JSX.Element {
  return <HistoryClient />;
}
