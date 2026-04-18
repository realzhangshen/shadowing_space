import { capabilitiesFor } from "@/features/practice/modeCapabilities";
import type { RepeatFlow } from "@/store/practiceStore";

export const REPEAT_FLOW_ORDER = [
  "manual",
  "auto",
  "free",
  "listen",
] as const satisfies readonly RepeatFlow[];

export function nextRepeatFlow(current: RepeatFlow): RepeatFlow {
  const idx = REPEAT_FLOW_ORDER.indexOf(current);
  if (idx < 0) return REPEAT_FLOW_ORDER[0];
  return REPEAT_FLOW_ORDER[(idx + 1) % REPEAT_FLOW_ORDER.length];
}

export type ListenAdvanceInput = {
  currentIndex: number;
  totalSegments: number;
};

export type ListenSegmentLike = {
  startMs: number;
  endMs: number;
};

export type ContinuousListenWindow = {
  startIndex: number;
  endIndex: number;
  startMs: number;
  endMs: number;
};

export function nextListenIndex({
  currentIndex,
  totalSegments,
}: ListenAdvanceInput): number | null {
  if (totalSegments <= 0) return null;
  const next = currentIndex + 1;
  if (next >= totalSegments) return null;
  return next;
}

export function buildContinuousListenWindow(
  segments: readonly ListenSegmentLike[],
  startIndex: number,
): ContinuousListenWindow | null {
  if (segments.length === 0) {
    return null;
  }

  const safeStartIndex = Math.min(Math.max(startIndex, 0), segments.length - 1);
  const startSegment = segments[safeStartIndex];
  const endIndex = segments.length - 1;
  const endSegment = segments[endIndex];
  if (!startSegment || !endSegment) {
    return null;
  }

  return {
    startIndex: safeStartIndex,
    endIndex,
    startMs: startSegment.startMs,
    endMs: endSegment.endMs,
  };
}

export type ListenSegmentIndexInput = {
  segments: readonly ListenSegmentLike[];
  window: ContinuousListenWindow;
  currentMs: number;
};

export function findListenSegmentIndex({
  segments,
  window,
  currentMs,
}: ListenSegmentIndexInput): number {
  let best = window.startIndex;
  for (let i = window.startIndex; i <= window.endIndex; i++) {
    const segment = segments[i];
    if (!segment) {
      break;
    }
    if (currentMs >= segment.startMs) {
      best = i;
    }
    if (currentMs < segment.endMs) {
      break;
    }
  }
  return best;
}

export type ListenNavigationInput = {
  repeatFlow: RepeatFlow;
};

export function shouldUseContinuousListenNavigation({
  repeatFlow,
}: ListenNavigationInput): boolean {
  return capabilitiesFor(repeatFlow).continuity === "sequential";
}

export type ListenTransportLabelInput = {
  listenSessionActive: boolean;
  isPlaying: boolean;
};

export function listenTransportLabelKey({
  listenSessionActive,
  isPlaying,
}: ListenTransportLabelInput): "play" | "pause" {
  return listenSessionActive || isPlaying ? "pause" : "play";
}
