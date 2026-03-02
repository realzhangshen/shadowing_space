"use client";

import { memo } from "react";
import type { PracticeMethod, PracticeScope } from "@/store/practiceStore";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  practiceMethod: PracticeMethod;
  practiceScope: PracticeScope;
  autoAdvance: boolean;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onSetPracticeMethod: (method: PracticeMethod) => void;
  onSetPracticeScope: (scope: PracticeScope) => void;
  onToggleAutoAdvance: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
};

const METHODS: { value: PracticeMethod; label: string }[] = [
  { value: "listen-repeat", label: "Listen & Repeat" },
  { value: "shadow", label: "Shadow" },
  { value: "listen", label: "Listen" }
];

const SCOPES: { value: PracticeScope; label: string }[] = [
  { value: "sentence", label: "Sentence" },
  { value: "all", label: "All" }
];

function getPlayLabel(method: PracticeMethod, scope: PracticeScope, isPlaying: boolean): string {
  if (isPlaying) return "⏸ Pause";
  if (method === "shadow" && scope === "all") return "▶ Shadow All";
  if (method === "shadow") return "▶ Shadow";
  if (method === "listen" && scope === "all") return "▶ Play All";
  return "▶ Play";
}

export const PlaybackControlBar = memo(function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  practiceMethod,
  practiceScope,
  autoAdvance,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording,
  onSetPracticeMethod,
  onSetPracticeScope,
  onToggleAutoAdvance,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled
}: PlaybackControlBarProps): JSX.Element {
  const showRecord = practiceMethod === "listen-repeat";
  const showReplay = practiceMethod !== "listen" && practiceScope === "sentence" && hasRecording;
  const showAutoAdvance = practiceMethod === "listen-repeat";
  const showHeadphoneHint = practiceMethod === "shadow";

  return (
    <div className="control-bar-wrap">
      <div className="control-bar">
        <button type="button" className="btn secondary" onClick={onPrev} disabled={prevDisabled}>
          ← Prev
        </button>

        <button
          type="button"
          className={practiceMethod === "shadow" && !isPlaying ? "btn secondary shadow-play-btn" : "btn secondary"}
          title={practiceMethod === "shadow" ? "Play + Record simultaneously" : isPlaying ? "Pause" : "Play"}
          onClick={onToggleOriginal}
        >
          {getPlayLabel(practiceMethod, practiceScope, isPlaying)}
        </button>

        {showRecord ? (
          <button
            type="button"
            className={isRecording ? "btn primary recording" : "btn primary"}
            title={isRecording ? "Stop recording" : "Record"}
            aria-pressed={isRecording}
            onClick={onToggleRecording}
          >
            {isRecording ? "⏹ Stop" : "🎤 Record"}
          </button>
        ) : null}

        {showReplay ? (
          <button
            type="button"
            className="btn secondary"
            title="Play recording"
            onClick={onPlayRecording}
          >
            🎧 Replay
          </button>
        ) : null}

        <button type="button" className="btn secondary" onClick={onNext} disabled={nextDisabled}>
          Next →
        </button>
      </div>

      <div className="mode-settings">
        <div className="method-selector" role="radiogroup" aria-label="Practice method">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={practiceMethod === m.value}
              className={practiceMethod === m.value ? "method-option active" : "method-option"}
              onClick={() => onSetPracticeMethod(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

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

        {showAutoAdvance ? (
          <label className="auto-advance-toggle">
            <input type="checkbox" checked={autoAdvance} onChange={onToggleAutoAdvance} />
            Auto-advance
          </label>
        ) : null}

        {showHeadphoneHint ? (
          <span className="headphone-hint">🎧 Use headphones</span>
        ) : null}
      </div>
    </div>
  );
});
