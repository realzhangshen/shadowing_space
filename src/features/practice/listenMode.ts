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

export function nextListenIndex({
  currentIndex,
  totalSegments,
}: ListenAdvanceInput): number | null {
  if (totalSegments <= 0) return null;
  const next = currentIndex + 1;
  if (next >= totalSegments) return null;
  return next;
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
