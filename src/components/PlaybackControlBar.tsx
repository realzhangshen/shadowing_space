"use client";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
};

export function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled
}: PlaybackControlBarProps): JSX.Element {
  return (
    <div className="control-bar">
      <button
        type="button"
        className="btn secondary"
        onClick={onPrev}
        disabled={prevDisabled}
      >
        ← Prev
      </button>

      <button
        type="button"
        className="btn secondary"
        title={isPlaying ? "Pause" : "Play"}
        onClick={onToggleOriginal}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play"}
      </button>

      <button
        type="button"
        className={isRecording ? "btn primary recording" : "btn primary"}
        title={isRecording ? "Stop recording" : "Record"}
        onClick={onToggleRecording}
      >
        {isRecording ? "⏹ Stop" : "🎤 Record"}
      </button>

      <button
        type="button"
        className="btn secondary"
        title="Play recording"
        disabled={!hasRecording}
        onClick={onPlayRecording}
      >
        🎧 Replay
      </button>

      <button
        type="button"
        className="btn secondary"
        onClick={onNext}
        disabled={nextDisabled}
      >
        Next →
      </button>
    </div>
  );
}
