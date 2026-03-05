import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ImportClient } from "@/features/import/ImportClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("importTitle"),
    description: t("importDescription"),
    robots: { index: false, follow: false },
  };
}

export default function ImportPage(): JSX.Element {
  return <ImportClient />;
}
