import type { SegmentRecord } from "@/types/models";

export function findHighlightIndex(
  segments: SegmentRecord[],
  currentMs: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  let best = rangeStart;
  for (let i = rangeStart; i <= rangeEnd; i++) {
    const seg = segments[i];
    if (!seg) break;
    if (currentMs >= seg.startMs) {
      best = i;
    }
    if (currentMs < seg.endMs) {
      break;
    }
  }
  return best;
}
