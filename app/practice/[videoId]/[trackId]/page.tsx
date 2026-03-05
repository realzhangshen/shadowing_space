import { PracticeClient } from "@/features/practice/PracticeClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice Session",
  description: "Shadowing practice session — listen, record, and compare your pronunciation.",
  robots: { index: false, follow: false },
};

type PracticePageProps = {
  params: Promise<{
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

  // Decode multiple times to tolerate segments that were encoded before client-side routing.
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
