"use client";

import { memo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { SegmentRecord } from "@/types/models";

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onSelectSegment: (index: number) => void;
  recordingReadySet: Set<number>;
  transcriptHidden: boolean;
  onToggleTranscriptHidden: () => void;
};

export const SegmentNavigator = memo(function SegmentNavigator({
  segments,
  currentIndex,
  onSelectSegment,
  recordingReadySet,
  transcriptHidden,
  onToggleTranscriptHidden
}: SegmentNavigatorProps): JSX.Element {
  const t = useTranslations("SegmentNavigator");
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  return (
    <section className="segment-card">
      <div className="segment-header">
        <h3 className="segment-title">{t("title")}</h3>
        <div className="segment-header-right">
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
            {Math.min(currentIndex + 1, segments.length)} / {segments.length}
          </p>
        </div>
      </div>

      <div className="segment-list" role="list" aria-label={t("sentenceList")}>
        {segments.map((segment, index) => {
          const isActive = index === currentIndex;
          const hasRecording = recordingReadySet.has(index);

          return (
            <div
              key={segment.id}
              ref={isActive ? activeRef : undefined}
              role="listitem"
              tabIndex={0}
              className={isActive ? "segment-item active" : "segment-item"}
              onClick={() => onSelectSegment(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSegment(index);
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
