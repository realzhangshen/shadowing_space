"use client";

import { useMemo, useState } from "react";
import { buildThumbnailCandidates } from "@/lib/thumbnail";

type VideoThumbnailProps = {
  className: string;
  src?: string;
};

export function VideoThumbnail({ className, src }: VideoThumbnailProps): JSX.Element {
  const candidates = useMemo(() => buildThumbnailCandidates(src), [src]);
  const [attempt, setAttempt] = useState<{ src?: string; index: number }>({ src, index: 0 });
  // Comparing the attempted src against the current one resets the fallback chain whenever the
  // card switches videos, so a stale failure from the previous thumbnail cannot skip candidates.
  const index = attempt.src === src ? attempt.index : 0;
  const currentSrc = candidates[index];

  if (!currentSrc) {
    return <div className={`${className} video-card-thumb-placeholder`} />;
  }

  return (
    <img
      className={className}
      src={currentSrc}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setAttempt({ src, index: index + 1 })}
    />
  );
}
