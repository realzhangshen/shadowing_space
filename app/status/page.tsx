import { StatusClient } from "@/features/status/StatusClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proxy Status - Shadowing Space"
};

export default function StatusPage(): JSX.Element {
  return <StatusClient />;
}
