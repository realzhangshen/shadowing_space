"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  computeVisibleWindow,
  isIndexInWindow,
  scrollOffsetForIndex,
} from "@/components/virtualWindow";
import type { FreeRange } from "@/store/practiceStore";
import type { SegmentRecord } from "@/types/models";

const VIRTUALIZE_MIN_COUNT = 80;
const ESTIMATED_ITEM_HEIGHT_PX = 88;
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
  const [rangeClickState, setRangeClickState] = useState<"idle" | "start-set">("idle");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const effectiveHighlight =
    freeMode && freeSessionActive ? (freeHighlightIndex ?? 0) : currentIndex;

  const virtualize = segments.length >= VIRTUALIZE_MIN_COUNT;

  useEffect(() => {
    setRangeClickState("idle");
  }, [freeMode]);

  useLayoutEffect(() => {
    if (!virtualize) return;
    const el = listRef.current;
    if (!el) return;

    const syncMetrics = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
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
    const observer = new ResizeObserver(syncMetrics);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [virtualize]);

  const visibleWindow = virtualize
    ? computeVisibleWindow({
        scrollTop,
        viewportHeight,
        itemHeight: ESTIMATED_ITEM_HEIGHT_PX,
        totalCount: segments.length,
        overscan: OVERSCAN,
      })
    : { startIndex: 0, endIndex: Math.max(0, segments.length - 1) };

  useEffect(() => {
    if (virtualize) {
      const el = listRef.current;
      if (!el) return;
      if (!isIndexInWindow(visibleWindow, effectiveHighlight)) {
        const offset = scrollOffsetForIndex(
          effectiveHighlight,
          ESTIMATED_ITEM_HEIGHT_PX,
          el.clientHeight,
          segments.length,
        );
        el.scrollTo({ top: offset, behavior: "smooth" });
      } else {
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // visibleWindow is recomputed each render; we intentionally only re-run on highlight change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveHighlight, virtualize, segments.length]);

  const topSpacer = virtualize ? visibleWindow.startIndex * ESTIMATED_ITEM_HEIGHT_PX : 0;
  const bottomSpacer = virtualize
    ? Math.max(0, (segments.length - visibleWindow.endIndex - 1) * ESTIMATED_ITEM_HEIGHT_PX)
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

      <div className="segment-list" role="list" aria-label={t("sentenceList")} ref={listRef}>
        {topSpacer > 0 ? <div aria-hidden="true" style={{ height: topSpacer }} /> : null}
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
        {bottomSpacer > 0 ? <div aria-hidden="true" style={{ height: bottomSpacer }} /> : null}
      </div>
    </section>
  );
});
