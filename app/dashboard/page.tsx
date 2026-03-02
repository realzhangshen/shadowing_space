import { HistoryClient } from "@/features/history/HistoryClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - Shadowing Space"
};

export default function DashboardPage(): JSX.Element {
  return <HistoryClient />;
}
