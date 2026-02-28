import type { SegmentRecord } from "@/types/models";

type SegmentNavigatorProps = {
  segments: SegmentRecord[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function SegmentNavigator({
  segments,
  currentIndex,
  onSelect,
  onPrev,
  onNext
}: SegmentNavigatorProps): JSX.Element {
  const current = segments[currentIndex];

  return (
    <section className="card segment-card">
      <div className="segment-header">
        <h3>Sentence</h3>
        <p className="muted">
          {Math.min(currentIndex + 1, segments.length)} / {segments.length}
        </p>
      </div>

      <p className="segment-current">{current?.text ?? "No segment"}</p>

      <div className="actions-row">
        <button className="btn secondary" type="button" onClick={onPrev} disabled={currentIndex <= 0}>
          Prev (←)
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={onNext}
          disabled={currentIndex >= segments.length - 1}
        >
          Next (→)
        </button>
      </div>

      <div className="segment-list" role="list" aria-label="Sentence list">
        {segments.map((segment, index) => (
          <button
            key={segment.id}
            role="listitem"
            type="button"
            className={index === currentIndex ? "segment-item active" : "segment-item"}
            onClick={() => onSelect(index)}
          >
            <span>{index + 1}</span>
            <p>{segment.text}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
