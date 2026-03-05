import { HistoryClient } from "@/features/history/HistoryClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "View your shadowing practice history and track progress across videos.",
  robots: { index: false, follow: false },
};

export default function DashboardPage(): JSX.Element {
  return <HistoryClient />;
}
