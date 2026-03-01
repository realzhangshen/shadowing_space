"use client";

import { useEffect, useRef } from "react";
import { usePracticeStore } from "@/store/practiceStore";
import type { SegmentRecord } from "@/types/models";

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onSelectSegment: (index: number) => void;
  recordingReadySet: Set<number>;
};

export function SegmentNavigator({
  segments,
  currentIndex,
  onSelectSegment,
  recordingReadySet
}: SegmentNavigatorProps): JSX.Element {
  const current = segments[currentIndex];
  const activeRef = useRef<HTMLDivElement | null>(null);
  const transcriptHidden = usePracticeStore((s) => s.transcriptHidden);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  const recordedCount = recordingReadySet.size;
  const totalCount = segments.length;
  const pct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  return (
    <section className="segment-card">
      <div className="segment-header">
        <h3>Sentences</h3>
        <div className="segment-header-right">
          <p className="muted">
            {Math.min(currentIndex + 1, segments.length)} / {segments.length}
          </p>
        </div>
      </div>

      <div className="progress-row">
        <span className="progress-pct">{recordedCount}/{totalCount} recorded</span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

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
}
