import { ImportClient } from "@/features/import/ImportClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Video",
  description: "Paste a YouTube URL to extract subtitles and start shadowing practice.",
  robots: { index: false, follow: false },
};

export default function ImportPage(): JSX.Element {
  return <ImportClient />;
}
