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
