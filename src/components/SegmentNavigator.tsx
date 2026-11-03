"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adjustScrollTopForMeasurements,
  buildItemOffsets,
  computeVisibleWindowByOffsets,
  indexAtOffset,
  isIndexInWindow,
  scrollOffsetForIndexByOffsets,
} from "@/components/virtualWindow";
import type { FreeRange } from "@/store/practiceStore";
import type { SegmentRecord } from "@/types/models";

const VIRTUALIZE_MIN_COUNT = 80;
/**
 * Initial stride guess for an unmeasured row. Measured segments are 41-62px
 * tall (1-2 wrapped lines) plus the `.segment-list` flex `gap` (0.45rem), so a
 * stride around 64px is a much better starting point than a fixed row height.
 * Real heights replace this once rows render (see `measureRenderedRows`).
 */
const ESTIMATED_ITEM_HEIGHT_PX = 64;
const OVERSCAN = 8;

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onSelectSegment: (index: number) => void;
  recordingReadySet: Set<number>;
  transcriptHidden: boolean;
  onToggleTranscriptHidden: () => void;
  freeMode?: boolean;
  freeRange?: FreeRange | null;
  freeHighlightIndex?: number;
  freeSessionActive?: boolean;
  onSetFreeRange?: (range: FreeRange | null) => void;
};

export const SegmentNavigator = memo(function SegmentNavigator({
  segments,
  currentIndex,
  onSelectSegment,
  recordingReadySet,
  transcriptHidden,
  onToggleTranscriptHidden,
  freeMode,
  freeRange,
  freeHighlightIndex,
  freeSessionActive,
  onSetFreeRange,
}: SegmentNavigatorProps): JSX.Element {
  const t = useTranslations("SegmentNavigator");
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  /** Measured row stride (offsetHeight + flex gap) per segment index. */
  const heightsRef = useRef<number[]>([]);
  /** CSS flex row-gap of `.segment-list`, read once from computed styles. */
  const rowGapRef = useRef<number | null>(null);
  const rowObserverRef = useRef<ResizeObserver | null>(null);
  const observedRowsRef = useRef<Set<HTMLElement>>(new Set());
  const offsetsRef = useRef<number[]>([]);
  const [rangeClickState, setRangeClickState] = useState<"idle" | "start-set">("idle");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  /** False while the list is not an actual scroll container (mobile layout). */
  const [scrollableList, setScrollableList] = useState(false);
  /** Bumped whenever measured row heights change so offsets get rebuilt. */
  const [measureTick, setMeasureTick] = useState(0);
  /** Active row that must stay rendered even when it is outside the scroll window. */
  const [forcedIndex, setForcedIndex] = useState<number | null>(null);

  const effectiveHighlight =
    freeMode && freeSessionActive ? (freeHighlightIndex ?? 0) : currentIndex;

  const virtualize = segments.length >= VIRTUALIZE_MIN_COUNT && scrollableList;

  // Measured heights live in a ref (updated by the DOM measurement pass); the
  // tick only signals that a new snapshot is needed.
  const measuredHeights = useMemo(
    () => Array.from({ length: segments.length }, (_, index) => heightsRef.current[index]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments.length, measureTick],
  );

  const offsets = useMemo(
    () =>
      buildItemOffsets({
        totalCount: segments.length,
        measuredHeights,
        estimatedHeight: ESTIMATED_ITEM_HEIGHT_PX,
      }),
    [segments.length, measuredHeights],
  );

  const baseWindow = virtualize
    ? computeVisibleWindowByOffsets({ scrollTop, viewportHeight, offsets, overscan: OVERSCAN })
    : { startIndex: 0, endIndex: Math.max(0, segments.length - 1) };

  const clampedForcedIndex =
    forcedIndex === null || segments.length === 0
      ? null
      : Math.max(0, Math.min(segments.length - 1, forcedIndex));
  const windowStartIndex =
    clampedForcedIndex === null
      ? baseWindow.startIndex
      : Math.min(baseWindow.startIndex, clampedForcedIndex);
  const windowEndIndex =
    clampedForcedIndex === null
      ? baseWindow.endIndex
      : Math.max(baseWindow.endIndex, clampedForcedIndex);
  const visibleWindow = { startIndex: windowStartIndex, endIndex: windowEndIndex };

  /** Align the scroll container metrics and detect whether it actually scrolls. */
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const syncMetrics = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
      const overflowY = getComputedStyle(el).overflowY;
      const nextScrollable =
        overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      setScrollableList((prev) => (prev === nextScrollable ? prev : nextScrollable));
    };

    syncMetrics();

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollTop(el.scrollTop);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncMetrics);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [virtualize, segments.length]);

  /**
   * Measures every rendered row and records its stride (`offsetHeight + gap`).
   * Rows above the window that changed height shift the visible content, so the
   * scroll position is corrected to keep the viewport anchored.
   */
  const measureRenderedRows = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    if (rowGapRef.current === null) {
      const parsed = Number.parseFloat(getComputedStyle(el).rowGap);
      rowGapRef.current = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    const gap = rowGapRef.current;

    const observer = rowObserverRef.current;
    const observed = observedRowsRef.current;
    const nextObserved = new Set<HTMLElement>();
    let heightsChanged = false;
    let shiftAboveViewport = 0;
    // Rows before the first visible row sit above the viewport; when their
    // height changes, the content under the viewport shifts and scrollTop has
    // to move by the same delta to keep the view anchored.
    const viewportStartIndex = indexAtOffset(offsetsRef.current, el.scrollTop);

    el.querySelectorAll<HTMLElement>("[data-segment-index]").forEach((node) => {
      nextObserved.add(node);
      if (observer && !observed.has(node)) {
        observer.observe(node);
        observed.add(node);
      }
      if (!node.isConnected) return;

      const index = Number(node.dataset.segmentIndex);
      if (!Number.isInteger(index) || index < 0 || index >= segments.length) return;

      const stride = node.offsetHeight + gap;
      if (!(stride > 0)) return;

      const previous = heightsRef.current[index];
      if (previous === stride) return;

      heightsRef.current[index] = stride;
      heightsChanged = true;
      if (index < viewportStartIndex) {
        // Compare against the previous best guess (the estimate) on first sight.
        shiftAboveViewport += stride - (previous ?? ESTIMATED_ITEM_HEIGHT_PX);
      }
    });

    observed.forEach((node) => {
      if (nextObserved.has(node)) return;
      observer?.unobserve(node);
      observed.delete(node);
    });

    if (!heightsChanged) return;

    if (shiftAboveViewport !== 0) {
      const nextScrollTop = adjustScrollTopForMeasurements(
        el.scrollTop,
        viewportStartIndex - 1,
        shiftAboveViewport,
        viewportStartIndex,
      );
      if (nextScrollTop !== el.scrollTop) {
        el.scrollTop = nextScrollTop;
        setScrollTop(el.scrollTop);
      }
    }

    setMeasureTick((tick) => tick + 1);
  }, [segments.length]);

  // Keep a stable handle for the ResizeObserver callback.
  const measureRenderedRowsRef = useRef(measureRenderedRows);
  useLayoutEffect(() => {
    measureRenderedRowsRef.current = measureRenderedRows;
  });

  // Offsets are read imperatively by the scroll effects below so those effects
  // do not need to re-run on every measurement tick.
  useLayoutEffect(() => {
    offsetsRef.current = offsets;
  });

  // Measure rendered rows on every commit (the pass is cheap: ~30 nodes max)
  // and refresh the size observer so wraps/width changes are picked up.
  useLayoutEffect(() => {
    if (!virtualize) return;
    measureRenderedRowsRef.current();
  });

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (!virtualize) return;

    const observer = new ResizeObserver(() => {
      measureRenderedRowsRef.current();
    });
    rowObserverRef.current = observer;
    const observed = observedRowsRef.current;
    listRef.current?.querySelectorAll<HTMLElement>("[data-segment-index]").forEach((node) => {
      observer.observe(node);
      observed.add(node);
    });

    return () => {
      observer.disconnect();
      rowObserverRef.current = null;
      observed.clear();
    };
  }, [virtualize]);

  // Reset measurements when the segment list itself changes (new video /
  // re-transcription) so stale strides from another transcript are not reused.
  const segmentsKey = `${segments.length}:${segments[0]?.id ?? ""}:${segments[segments.length - 1]?.id ?? ""}`;
  const segmentsKeyRef = useRef(segmentsKey);
  useEffect(() => {
    if (segmentsKeyRef.current === segmentsKey) return;
    segmentsKeyRef.current = segmentsKey;
    heightsRef.current = [];
    setMeasureTick((tick) => tick + 1);
  }, [segmentsKey]);

  /** Scrolls an already-rendered row to the middle of the list. */
  const scrollElementIntoCenter = useCallback((listEl: HTMLDivElement, itemEl: HTMLElement) => {
    const listRect = listEl.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const itemTop = listEl.scrollTop + (itemRect.top - listRect.top);
    const max = Math.max(0, listEl.scrollHeight - listEl.clientHeight);
    const centered = itemTop - Math.max(0, listEl.clientHeight - itemRect.height) / 2;
    const next = Math.max(0, Math.min(max, centered));
    if (Math.abs(next - listEl.scrollTop) < 1) return;
    listEl.scrollTo({ top: next, behavior: "auto" });
  }, []);

  // Keep the active row visible. A row outside the current window is forced to
  // render (inside the spacer gap) so it can be positioned exactly from its DOM
  // rect; the estimated offsets are only used for the rough initial jump.
  const revealActiveRow = useCallback(() => {
    const el = listRef.current;
    if (!el || segments.length === 0) return;

    const index = Math.max(0, Math.min(segments.length - 1, effectiveHighlight));
    const currentOffsets = offsetsRef.current;
    const currentWindow = computeVisibleWindowByOffsets({
      scrollTop: el.scrollTop,
      viewportHeight: el.clientHeight,
      offsets: currentOffsets,
      overscan: OVERSCAN,
    });

    if (isIndexInWindow(currentWindow, index)) {
      const itemTop = currentOffsets[index] ?? 0;
      const itemBottom = currentOffsets[index + 1] ?? itemTop;
      const fullyVisible =
        itemTop >= el.scrollTop - 1 && itemBottom <= el.scrollTop + el.clientHeight + 1;
      if (!fullyVisible) {
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }

    // Far jump: render the row, jump roughly to its estimated offset, then let
    // the layout effect below center it from its measured DOM rect.
    setForcedIndex(index);
    el.scrollTo({
      top: scrollOffsetForIndexByOffsets(index, currentOffsets, el.clientHeight, segments.length),
      behavior: "auto",
    });
    // Offsets/viewport are read live from refs and the DOM, so this callback
    // does not need to change on every measurement tick.
  }, [effectiveHighlight, segments.length]);

  useEffect(() => {
    if (!virtualize) {
      setForcedIndex(null);
      if (segments.length > 0) {
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }
    revealActiveRow();
  }, [revealActiveRow, virtualize, segments.length]);

  const revealActiveRowRef = useRef(revealActiveRow);
  useEffect(() => {
    revealActiveRowRef.current = revealActiveRow;
  }, [revealActiveRow]);

  // A viewport height change (window resize, layout switch) can shrink the
  // rendered window away from the active row without any scroll; bring it back.
  // A new segment list (same length, different video) also needs a re-check.
  useEffect(() => {
    if (!virtualize) return;
    revealActiveRowRef.current();
  }, [segmentsKey, viewportHeight, virtualize, segments.length]);

  // Exact post-render positioning for a row forced to render outside the
  // measured window (e.g. resuming at segment 90 on load). Rect-based, so it
  // stays correct even while the skipped rows only have estimated heights.
  useLayoutEffect(() => {
    if (!virtualize || forcedIndex === null) return;
    const el = listRef.current;
    if (!el || segments.length === 0) return;

    const index = Math.max(0, Math.min(segments.length - 1, forcedIndex));
    const activeEl = activeRef.current;
    if (!activeEl) return;

    const listRect = el.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    const itemTop = itemRect.top - listRect.top;
    const fullyVisible = itemTop >= -1 && itemTop + itemRect.height <= el.clientHeight + 1;
    if (!fullyVisible) scrollElementIntoCenter(el, activeEl);

    const currentWindow = computeVisibleWindowByOffsets({
      scrollTop: el.scrollTop,
      viewportHeight: el.clientHeight,
      offsets: offsetsRef.current,
      overscan: OVERSCAN,
    });
    if (isIndexInWindow(currentWindow, index)) {
      setForcedIndex(null);
    }
  }, [
    forcedIndex,
    measureTick,
    scrollTop,
    viewportHeight,
    virtualize,
    segments.length,
    scrollElementIntoCenter,
  ]);

  // Spacers must never shrink: `.segment-list` is a column flex container, and
  // the default `flex-shrink: 1` would collapse them (the original scroll bug).
  // The flex `gap` already contributes one gap next to each spacer, so it is
  // subtracted here to keep the total content height equal to the full offsets.
  const rowGap = rowGapRef.current ?? 0;
  const hasTopSpacer = virtualize && visibleWindow.startIndex > 0;
  const hasBottomSpacer = virtualize && visibleWindow.endIndex + 1 < segments.length;
  const topSpacer = hasTopSpacer
    ? Math.max(0, (offsets[visibleWindow.startIndex] ?? 0) - rowGap)
    : 0;
  const bottomSpacer = hasBottomSpacer
    ? Math.max(
        0,
        (offsets[segments.length] ?? 0) - (offsets[visibleWindow.endIndex + 1] ?? 0) - rowGap,
      )
    : 0;
  const visibleSegments = virtualize
    ? segments.slice(visibleWindow.startIndex, visibleWindow.endIndex + 1)
    : segments;

  const handleFreeClick = useCallback(
    (index: number) => {
      if (!onSetFreeRange || freeSessionActive) return;

      if (rangeClickState === "idle") {
        onSetFreeRange({ startIndex: index, endIndex: index });
        setRangeClickState("start-set");
      } else {
        const currentRange = freeRange;
        if (currentRange) {
          const start = Math.min(currentRange.startIndex, index);
          const end = Math.max(currentRange.startIndex, index);
          onSetFreeRange({ startIndex: start, endIndex: end });
        }
        setRangeClickState("idle");
      }
    },
    [freeRange, freeSessionActive, onSetFreeRange, rangeClickState],
  );

  const selectAll = useCallback(() => {
    if (segments.length === 0 || !onSetFreeRange) return;
    onSetFreeRange({ startIndex: 0, endIndex: segments.length - 1 });
    setRangeClickState("idle");
  }, [onSetFreeRange, segments.length]);

  const fromCurrent = useCallback(() => {
    if (segments.length === 0 || !onSetFreeRange) return;
    const fromIndex = freeMode && freeRange ? freeRange.startIndex : currentIndex;
    onSetFreeRange({ startIndex: fromIndex, endIndex: segments.length - 1 });
    setRangeClickState("idle");
  }, [currentIndex, freeMode, freeRange, onSetFreeRange, segments.length]);

  return (
    <section className="segment-card">
      <div className="segment-header">
        <h3 className="segment-title">{freeMode ? t("freeRangeTitle") : t("title")}</h3>
        <div className="segment-header-right">
          {freeMode && !freeSessionActive ? (
            <div className="free-range-header">
              <button type="button" className="icon-btn" onClick={selectAll}>
                {t("selectAll")}
              </button>
              <button type="button" className="icon-btn" onClick={fromCurrent}>
                {t("fromCurrent")}
              </button>
              {rangeClickState === "start-set" ? (
                <span className="range-hint">{t("clickEndPoint")}</span>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="transcript-toggle icon-btn"
            onClick={onToggleTranscriptHidden}
            title={transcriptHidden ? t("showTitle") : t("hideTitle")}
            aria-pressed={!transcriptHidden}
          >
            {transcriptHidden ? t("show") : t("hide")}
          </button>
          <p className="muted">
            {Math.min(effectiveHighlight + 1, segments.length)} / {segments.length}
          </p>
        </div>
      </div>

      <div
        className="segment-list"
        role="list"
        aria-label={t("sentenceList")}
        ref={listRef}
        style={{ overflowAnchor: "none" }}
      >
        {topSpacer > 0 ? (
          <div
            aria-hidden="true"
            data-virtual-spacer="top"
            style={{ height: topSpacer, flex: "0 0 auto" }}
          />
        ) : null}
        {visibleSegments.map((segment, offset) => {
          const index = virtualize ? visibleWindow.startIndex + offset : offset;
          const isFreeHighlight = freeMode && freeSessionActive && index === freeHighlightIndex;
          const isActive = freeMode ? isFreeHighlight : index === currentIndex;
          const hasRecording = recordingReadySet.has(index);

          let rangeClass = "";
          if (freeMode && freeRange) {
            if (index >= freeRange.startIndex && index <= freeRange.endIndex) {
              rangeClass = " in-range";
            } else {
              rangeClass = " out-of-range";
            }
          }

          return (
            <div
              key={segment.id}
              ref={isActive ? activeRef : undefined}
              role="listitem"
              tabIndex={0}
              data-segment-index={index}
              className={`segment-item${isActive ? " active" : ""}${rangeClass}`}
              onClick={() => (freeMode ? handleFreeClick(index) : onSelectSegment(index))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (freeMode) handleFreeClick(index);
                  else onSelectSegment(index);
                }
              }}
            >
              <span className="segment-index">
                {hasRecording ? <span className="recording-dot" /> : null}
                {index + 1}
              </span>
              <p className={transcriptHidden ? "segment-text segment-blurred" : "segment-text"}>
                {segment.text}
              </p>
            </div>
          );
        })}
        {bottomSpacer > 0 ? (
          <div
            aria-hidden="true"
            data-virtual-spacer="bottom"
            style={{ height: bottomSpacer, flex: "0 0 auto" }}
          />
        ) : null}
      </div>
    </section>
  );
});
