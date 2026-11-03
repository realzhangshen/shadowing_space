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

/** Height used for a row that has not been measured yet (or reported a bogus size). */
const MIN_ITEM_HEIGHT_PX = 1;

type BuildItemOffsetsInput = {
  totalCount: number;
  /** Measured stride per row; `undefined` / non-finite / non-positive entries use the estimate. */
  measuredHeights?: ReadonlyArray<number | undefined>;
  estimatedHeight: number;
};

/**
 * Prefix sums of the row strides: `offsets[i]` is the top of row `i` and
 * `offsets[totalCount]` is the total content height. Length is always
 * `totalCount + 1`, even for degenerate counts (then `[0]`).
 */
export function buildItemOffsets({
  totalCount,
  measuredHeights = [],
  estimatedHeight,
}: BuildItemOffsetsInput): number[] {
  const count = Number.isFinite(totalCount) ? Math.max(0, Math.floor(totalCount)) : 0;
  const fallbackHeight =
    Number.isFinite(estimatedHeight) && estimatedHeight > 0 ? estimatedHeight : MIN_ITEM_HEIGHT_PX;

  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let index = 0; index < count; index += 1) {
    const measured = measuredHeights[index];
    const height =
      typeof measured === "number" && Number.isFinite(measured) && measured > 0
        ? measured
        : fallbackHeight;
    offsets[index + 1] = offsets[index] + height;
  }
  return offsets;
}

/**
 * Index of the row whose vertical slot contains `scrollTop`, clamped to the
 * list bounds. Binary search over the prefix-sum boundaries.
 */
export function indexAtOffset(offsets: number[], scrollTop: number): number {
  const totalCount = offsets.length - 1;
  if (totalCount <= 0 || !Number.isFinite(scrollTop)) return 0;

  const firstOffset = offsets[0] ?? 0;
  if (scrollTop <= firstOffset) return 0;

  const totalHeight = offsets[totalCount] ?? firstOffset;
  if (scrollTop >= totalHeight) return totalCount - 1;

  let low = 0;
  let high = totalCount - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((offsets[mid] ?? firstOffset) <= scrollTop) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

type VisibleWindowByOffsetsInput = {
  scrollTop: number;
  viewportHeight: number;
  offsets: number[];
  overscan?: number;
};

/**
 * Visible window derived from measured (variable) row offsets instead of a
 * fixed row height. Falls back to the full range when the viewport or the
 * offsets are degenerate so the caller never renders an empty list.
 */
export function computeVisibleWindowByOffsets({
  scrollTop,
  viewportHeight,
  offsets,
  overscan = 6,
}: VisibleWindowByOffsetsInput): VisibleWindow {
  const totalCount = Math.max(0, offsets.length - 1);
  if (totalCount <= 0) return { startIndex: 0, endIndex: 0 };
  if (!(viewportHeight > 0)) return { startIndex: 0, endIndex: totalCount - 1 };

  const safeOverscan = Number.isFinite(overscan) ? Math.max(0, Math.floor(overscan)) : 0;
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;

  const startIndex = Math.max(0, indexAtOffset(offsets, safeScrollTop) - safeOverscan);
  const bottomIndex = indexAtOffset(offsets, safeScrollTop + viewportHeight) + safeOverscan;
  const endIndex = Math.min(totalCount - 1, Math.max(startIndex, bottomIndex));

  return { startIndex, endIndex };
}

/**
 * Scroll offset that centers row `index` using measured offsets, clamped to
 * the list bounds. Mirrors {@link scrollOffsetForIndex} but for variable rows.
 */
export function scrollOffsetForIndexByOffsets(
  index: number,
  offsets: number[],
  viewportHeight: number,
  totalCount: number,
): number {
  const itemCount = Math.max(0, Math.min(totalCount, offsets.length - 1));
  if (itemCount <= 0) return 0;

  const safeViewport = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  const clampedIndex = Number.isFinite(index)
    ? Math.max(0, Math.min(itemCount - 1, Math.floor(index)))
    : 0;

  const itemTop = offsets[clampedIndex] ?? 0;
  const itemBottom = offsets[clampedIndex + 1] ?? itemTop;
  const itemHeight = Math.max(0, itemBottom - itemTop);
  const centered = itemTop - Math.max(0, safeViewport - itemHeight) / 2;
  const max = Math.max(0, (offsets[itemCount] ?? 0) - safeViewport);
  return Math.max(0, Math.min(max, centered));
}

/**
 * Keeps the viewport visually anchored when a measured row changes height.
 * Only rows above the rendered window (`changedIndex < windowStartIndex`) shift
 * the content that is currently on screen; rows inside or below the window are
 * accounted for by the window recomputation itself.
 */
export function adjustScrollTopForMeasurements(
  prevScrollTop: number,
  changedIndex: number,
  delta: number,
  windowStartIndex: number,
): number {
  const base = Number.isFinite(prevScrollTop) ? Math.max(0, prevScrollTop) : 0;
  if (!Number.isFinite(delta) || delta === 0) return base;
  if (!Number.isFinite(changedIndex) || !Number.isFinite(windowStartIndex)) return base;
  if (changedIndex >= windowStartIndex) return base;
  return Math.max(0, base + delta);
}

type WindowAroundIndexInput = {
  index: number;
  totalCount: number;
  viewportHeight: number;
  estimatedHeight: number;
  overscan?: number;
};

/**
 * One-viewport window of rows centered on `index`, clamped to the list bounds.
 * Used for a far programmatic jump: rendering only the target neighbourhood
 * (instead of every row between the old window and the target) keeps the DOM
 * small; the spacers keep the layout correct and the caller scrolls the row
 * into view afterwards.
 */
export function computeWindowAroundIndex({
  index,
  totalCount,
  viewportHeight,
  estimatedHeight,
  overscan = 0,
}: WindowAroundIndexInput): VisibleWindow {
  const count = Number.isFinite(totalCount) ? Math.max(0, Math.floor(totalCount)) : 0;
  if (count <= 0) return { startIndex: 0, endIndex: 0 };

  const safeOverscan = Number.isFinite(overscan) ? Math.max(0, Math.floor(overscan)) : 0;
  const rowStride =
    Number.isFinite(estimatedHeight) && estimatedHeight > 0 ? estimatedHeight : MIN_ITEM_HEIGHT_PX;
  const viewportRows =
    Number.isFinite(viewportHeight) && viewportHeight > 0
      ? Math.ceil(viewportHeight / rowStride)
      : 0;
  const span = Math.max(1, viewportRows + safeOverscan * 2);
  if (span >= count) return { startIndex: 0, endIndex: count - 1 };

  const clampedIndex = Number.isFinite(index)
    ? Math.max(0, Math.min(count - 1, Math.floor(index)))
    : 0;
  const half = Math.floor(span / 2);
  const startIndex = Math.max(0, Math.min(clampedIndex - half, count - span));
  const endIndex = Math.min(count - 1, startIndex + span - 1);

  return { startIndex, endIndex };
}
