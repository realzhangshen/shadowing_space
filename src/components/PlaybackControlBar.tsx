"use client";

import { memo } from "react";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  shadowingMode: boolean;
  continuousPlay: boolean;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onToggleShadowingMode: () => void;
  onToggleContinuousPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
};

export const PlaybackControlBar = memo(function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  shadowingMode,
  continuousPlay,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording,
  onToggleShadowingMode,
  onToggleContinuousPlay,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled
}: PlaybackControlBarProps): JSX.Element {
  const playLabel = shadowingMode
    ? isPlaying ? "⏸ Pause" : "▶ Shadow"
    : isPlaying ? "⏸ Pause" : "▶ Play";

  return (
    <div className="control-bar-wrap">
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
          className={shadowingMode && !isPlaying ? "btn secondary shadow-play-btn" : "btn secondary"}
          title={shadowingMode ? "Play + Record simultaneously" : isPlaying ? "Pause" : "Play"}
          onClick={onToggleOriginal}
        >
          {playLabel}
        </button>

        <button
          type="button"
          className={isRecording ? "btn primary recording" : "btn primary"}
          title={isRecording ? "Stop recording" : "Record"}
          aria-pressed={isRecording}
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

      <div className="mode-toggles">
        <button
          type="button"
          className={shadowingMode ? "btn secondary mode-toggle active-mode" : "btn secondary mode-toggle"}
          title="Shadow mode: play + record at the same time (S)"
          aria-pressed={shadowingMode}
          onClick={onToggleShadowingMode}
        >
          🎧 Shadow
        </button>
        <button
          type="button"
          className={continuousPlay ? "btn secondary mode-toggle active-mode" : "btn secondary mode-toggle"}
          title="Continuous play: play through all sentences without stopping (C)"
          aria-pressed={continuousPlay}
          onClick={onToggleContinuousPlay}
        >
          ▶▶ Continuous
        </button>
        {shadowingMode ? (
          <span className="headphone-hint">Use headphones for best results</span>
        ) : null}
      </div>
    </div>
  );
});
