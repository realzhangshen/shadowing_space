"use client";

import { memo, useEffect, useRef } from "react";
import type { SegmentRecord } from "@/types/models";
import type { PracticeScope } from "@/store/practiceStore";

const SCOPES: { value: PracticeScope; label: string }[] = [
  { value: "sentence", label: "Sentences" },
  { value: "free", label: "Free" }
];

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onSelectSegment: (index: number) => void;
  recordingReadySet: Set<number>;
  transcriptHidden: boolean;
  onToggleTranscriptHidden: () => void;
  practiceScope: PracticeScope;
  onSetPracticeScope: (scope: PracticeScope) => void;
};

export const SegmentNavigator = memo(function SegmentNavigator({
  segments,
  currentIndex,
  onSelectSegment,
  recordingReadySet,
  transcriptHidden,
  onToggleTranscriptHidden,
  practiceScope,
  onSetPracticeScope
}: SegmentNavigatorProps): JSX.Element {
  const current = segments[currentIndex];
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  const isFree = practiceScope === "free";
  const recordedCount = recordingReadySet.size;
  const totalCount = segments.length;
  const pct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  return (
    <section className="segment-card">
      <div className="segment-header">
        <div className="scope-toggle" role="radiogroup" aria-label="Practice scope">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={practiceScope === s.value}
              className={practiceScope === s.value ? "scope-option active" : "scope-option"}
              onClick={() => onSetPracticeScope(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="segment-header-right">
          <button
            type="button"
            className="transcript-toggle icon-btn"
            onClick={onToggleTranscriptHidden}
            title={transcriptHidden ? "Show sentences" : "Hide sentences"}
            aria-pressed={!transcriptHidden}
          >
            {transcriptHidden ? "Show" : "Hide"}
          </button>
          {!isFree ? (
            <p className="muted">
              {Math.min(currentIndex + 1, segments.length)} / {segments.length}
            </p>
          ) : null}
        </div>
      </div>

      {!isFree ? (
        <div className="progress-row">
          <span className="progress-pct">{recordedCount}/{totalCount} recorded</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <p className={transcriptHidden ? "segment-current segment-blurred" : "segment-current"}>
        {current?.text ?? "No segment"}
      </p>

      <div className="segment-list" role="list" aria-label="Sentence list">
        {segments.map((segment, index) => {
          const isActive = index === currentIndex;
          const hasRecording = recordingReadySet.has(index);

          return (
            <div
              key={segment.id}
              ref={isActive ? activeRef : undefined}
              role="listitem"
              tabIndex={0}
              className={
                isActive
                  ? isFree
                    ? "segment-item active reference-only"
                    : "segment-item active"
                  : isFree
                    ? "segment-item reference-only"
                    : "segment-item"
              }
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
