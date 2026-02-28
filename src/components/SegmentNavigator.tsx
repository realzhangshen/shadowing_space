"use client";

import { useEffect, useRef } from "react";
import type { SegmentRecord } from "@/types/models";

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onPlayOriginal: (index: number) => void;
  onToggleRecording: (index: number) => void;
  onPlayRecording: (index: number) => void;
  recordingReadySet: Set<number>;
  isRecording: boolean;
  recordingIndex: number | null;
};

export function SegmentNavigator({
  segments,
  currentIndex,
  onPlayOriginal,
  onToggleRecording,
  onPlayRecording,
  recordingReadySet,
  isRecording,
  recordingIndex
}: SegmentNavigatorProps): JSX.Element {
  const current = segments[currentIndex];
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  return (
    <section className="segment-card">
      <div className="segment-header">
        <h3>Sentences</h3>
        <p className="muted">
          {Math.min(currentIndex + 1, segments.length)} / {segments.length}
        </p>
      </div>

      <p className="segment-current">{current?.text ?? "No segment"}</p>

      <div className="segment-list" role="list" aria-label="Sentence list">
        {segments.map((segment, index) => {
          const isActive = index === currentIndex;
          const hasRecording = recordingReadySet.has(index);
          const isRecordingThis = isRecording && recordingIndex === index;

          return (
            <div
              key={segment.id}
              ref={isActive ? activeRef : undefined}
              role="listitem"
              tabIndex={0}
              className={isActive ? "segment-item active" : "segment-item"}
              onClick={() => onPlayOriginal(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPlayOriginal(index);
                }
              }}
            >
              <span className="segment-index">{index + 1}</span>
              <p className="segment-text">{segment.text}</p>
              <span className="segment-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={isRecordingThis ? "icon-btn recording-active" : "icon-btn"}
                  title={isRecordingThis ? "Stop recording" : "Record"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleRecording(index);
                  }}
                >
                  🎙
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Play recording"
                  disabled={!hasRecording}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayRecording(index);
                  }}
                >
                  🎧
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
