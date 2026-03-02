"use client";

import { memo } from "react";
import type { PracticeMethod, PracticeScope, RepeatFlow } from "@/store/practiceStore";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  practiceMethod: PracticeMethod;
  practiceScope: PracticeScope;
  repeatFlow: RepeatFlow;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onSetPracticeMethod: (method: PracticeMethod) => void;
  onSetRepeatFlow: (flow: RepeatFlow) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
};

const METHODS: { value: PracticeMethod; label: string }[] = [
  { value: "listen-repeat", label: "Listen & Repeat" },
  { value: "shadow", label: "Shadow" }
];

const FLOWS: { value: RepeatFlow; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "auto", label: "Auto" }
];

function getPlayLabel(method: PracticeMethod, scope: PracticeScope, isPlaying: boolean): string {
  if (isPlaying) return "⏸ Pause";
  if (method === "shadow") return "▶ Shadow";
  return "▶ Play";
}

export const PlaybackControlBar = memo(function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  practiceMethod,
  practiceScope,
  repeatFlow,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording,
  onSetPracticeMethod,
  onSetRepeatFlow,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled
}: PlaybackControlBarProps): JSX.Element {
  const isSentenceScope = practiceScope === "sentence";
  const showRecord = practiceMethod === "listen-repeat" && repeatFlow === "manual";
  const showReplay = practiceScope === "sentence" && hasRecording;
  const showHeadphoneHint = practiceMethod === "shadow";

  return (
    <div className="control-bar-wrap">
      <div className="control-bar">
        {isSentenceScope ? (
          <button type="button" className="btn secondary" onClick={onPrev} disabled={prevDisabled}>
            ← Prev
          </button>
        ) : null}

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

        {isSentenceScope ? (
          <button type="button" className="btn secondary" onClick={onNext} disabled={nextDisabled}>
            Next →
          </button>
        ) : null}
      </div>

      <div className="mode-settings">
        {isSentenceScope ? (
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
        ) : null}

        {isSentenceScope ? (
          <div className="scope-toggle" role="radiogroup" aria-label="Practice flow">
            {FLOWS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={repeatFlow === f.value}
                className={repeatFlow === f.value ? "scope-option active" : "scope-option"}
                onClick={() => onSetRepeatFlow(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}

        {showHeadphoneHint ? (
          <span className="headphone-hint">🎧 Use headphones</span>
        ) : null}
      </div>
    </div>
  );
});
