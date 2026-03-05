import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PracticeClient } from "@/features/practice/PracticeClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("practiceTitle"),
    description: t("practiceDescription"),
    robots: { index: false, follow: false },
  };
}

type PracticePageProps = {
  params: Promise<{
    locale: string;
    videoId: string;
    trackId: string;
  }>;
};

export default async function PracticePage({ params }: PracticePageProps): Promise<JSX.Element> {
  const resolved = await params;
  const videoId = decodeRouteParam(resolved.videoId);
  const trackId = decodeRouteParam(resolved.trackId);

  return <PracticeClient videoId={videoId} trackId={trackId} />;
}

function decodeRouteParam(value: string): string {
  let decoded = value;

  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }

  return decoded;
}
