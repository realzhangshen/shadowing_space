"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SegmentRecord } from "@/types/models";

type FreeRange = { startIndex: number; endIndex: number };

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
  onSetFreeRange
}: SegmentNavigatorProps): JSX.Element {
  const t = useTranslations("SegmentNavigator");
  const activeRef = useRef<HTMLDivElement | null>(null);
  const [rangeClickState, setRangeClickState] = useState<"idle" | "start-set">("idle");

  const effectiveHighlight = freeMode && freeSessionActive ? freeHighlightIndex ?? 0 : currentIndex;

  useEffect(() => {
    setRangeClickState("idle");
  }, [freeMode]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [effectiveHighlight]);

  const handleFreeClick = useCallback((index: number) => {
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
  }, [freeRange, freeSessionActive, onSetFreeRange, rangeClickState]);

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
        <h3 className="segment-title">
          {freeMode ? t("freeRangeTitle") : t("title")}
        </h3>
        <div className="segment-header-right">
          {freeMode && !freeSessionActive ? (
            <div className="free-range-header">
              <button type="button" className="icon-btn" onClick={selectAll}>{t("selectAll")}</button>
              <button type="button" className="icon-btn" onClick={fromCurrent}>{t("fromCurrent")}</button>
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

      <div className="segment-list" role="list" aria-label={t("sentenceList")}>
        {segments.map((segment, index) => {
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
              onClick={() => freeMode ? handleFreeClick(index) : onSelectSegment(index)}
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
      </div>
    </section>
  );
});
