export const DEFAULT_SEGMENT_END_TOLERANCE_MS = 50;
export const DEFAULT_SEGMENT_WATCH_TICK_MS = 100;

export function hasReachedSegmentEnd(
  currentMs: number,
  endMs: number,
  toleranceMs: number = DEFAULT_SEGMENT_END_TOLERANCE_MS,
): boolean {
  return currentMs + toleranceMs >= endMs;
}

export type SegmentWatcher = { cancel: () => void };

type WatcherDeps = {
  getCurrentMs: () => number;
  endMs: number;
  onReached: () => void;
  toleranceMs?: number;
  tickMs?: number;
};

export function startSegmentWatcher({
  getCurrentMs,
  endMs,
  onReached,
  toleranceMs = DEFAULT_SEGMENT_END_TOLERANCE_MS,
  tickMs = DEFAULT_SEGMENT_WATCH_TICK_MS,
}: WatcherDeps): SegmentWatcher {
  let fired = false;
  const id = globalThis.setInterval(() => {
    if (fired) return;
    if (hasReachedSegmentEnd(getCurrentMs(), endMs, toleranceMs)) {
      fired = true;
      globalThis.clearInterval(id);
      onReached();
    }
  }, tickMs);
  return {
    cancel: () => {
      if (fired) return;
      fired = true;
      globalThis.clearInterval(id);
    },
  };
}
