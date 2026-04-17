export type VisibleWindow = {
  startIndex: number;
  endIndex: number;
};

type VisibleWindowInput = {
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  totalCount: number;
  overscan?: number;
};

export function computeVisibleWindow({
  scrollTop,
  viewportHeight,
  itemHeight,
  totalCount,
  overscan = 6,
}: VisibleWindowInput): VisibleWindow {
  if (totalCount <= 0 || itemHeight <= 0 || viewportHeight <= 0) {
    return { startIndex: 0, endIndex: Math.max(0, totalCount - 1) };
  }
  const first = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const startIndex = Math.max(0, first - overscan);
  const endIndex = Math.min(totalCount - 1, first + visibleCount + overscan);
  return { startIndex, endIndex };
}

export function isIndexInWindow(window: VisibleWindow, index: number): boolean {
  return index >= window.startIndex && index <= window.endIndex;
}

export function scrollOffsetForIndex(
  index: number,
  itemHeight: number,
  viewportHeight: number,
  totalCount: number,
): number {
  if (itemHeight <= 0 || totalCount <= 0) return 0;
  const clamped = Math.max(0, Math.min(totalCount - 1, index));
  const target = clamped * itemHeight;
  // Center the target item within the viewport when possible.
  const centered = target - Math.max(0, viewportHeight - itemHeight) / 2;
  const max = Math.max(0, totalCount * itemHeight - viewportHeight);
  return Math.max(0, Math.min(max, centered));
}
