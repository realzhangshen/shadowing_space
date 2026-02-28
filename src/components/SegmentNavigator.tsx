import type { SegmentRecord } from "@/types/models";

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
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
  onSelect,
  onPrev,
  onNext,
  onPlayOriginal,
  onToggleRecording,
  onPlayRecording,
  recordingReadySet,
  isRecording,
  recordingIndex
}: SegmentNavigatorProps): JSX.Element {
  const current = segments[currentIndex];

  return (
    <section className="card segment-card">
      <div className="segment-header">
        <h3>Sentences</h3>
        <p className="muted">
          {Math.min(currentIndex + 1, segments.length)} / {segments.length}
        </p>
      </div>

      <p className="segment-current">{current?.text ?? "No segment"}</p>

      <div className="actions-row">
        <button className="btn secondary" type="button" onClick={onPrev} disabled={currentIndex <= 0}>
          Prev
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={onNext}
          disabled={currentIndex >= segments.length - 1}
        >
          Next
        </button>
      </div>

      <div className="segment-list" role="list" aria-label="Sentence list">
        {segments.map((segment, index) => {
          const isActive = index === currentIndex;
          const hasRecording = recordingReadySet.has(index);
          const isRecordingThis = isRecording && recordingIndex === index;

          return (
            <button
              key={segment.id}
              role="listitem"
              type="button"
              className={isActive ? "segment-item active" : "segment-item"}
              onClick={() => onSelect(index)}
            >
              <span className="segment-index">{index + 1}</span>
              <p className="segment-text">{segment.text}</p>
              <span className="segment-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="icon-btn"
                  title="Play original"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayOriginal(index);
                  }}
                >
                  ▶
                </button>
                <button
                  type="button"
                  className={isRecordingThis ? "icon-btn recording-active" : "icon-btn"}
                  title={isRecordingThis ? "Stop recording" : "Record"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleRecording(index);
                  }}
                >
                  ●
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
            </button>
          );
        })}
      </div>
    </section>
  );
}
