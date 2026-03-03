"use client";

import { memo } from "react";
import type { MicStatus } from "@/hooks/useRecorder";
import type { PracticeScope, RepeatFlow } from "@/store/practiceStore";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  micStatus: MicStatus;
  volume: number;
  practiceScope: PracticeScope;
  repeatFlow: RepeatFlow;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onSetRepeatFlow: (flow: RepeatFlow) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
};

const FLOWS: { value: RepeatFlow; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "auto", label: "Auto" }
];

const VOLUME_BARS = 5;
const BAR_HEIGHTS = [0.3, 0.5, 0.7, 0.85, 1.0];

function getPlayLabel(isAuto: boolean, isPlaying: boolean): string {
  if (isPlaying) return "⏸ Pause";
  if (isAuto) return "▶ Shadow";
  return "▶ Play";
}

function MicStatusIndicator({ micStatus }: { micStatus: MicStatus }): JSX.Element | null {
  if (micStatus === "idle") return null;

  if (micStatus === "acquiring") {
    return <span className="mic-status acquiring">Preparing...</span>;
  }

  if (micStatus === "error") {
    return <span className="mic-status error">No mic</span>;
  }

  // active
  return <span className="mic-status active" aria-label="Microphone active">🎤</span>;
}

function VolumeMeter({ volume }: { volume: number }): JSX.Element {
  return (
    <span className="volume-meter" aria-label={`Volume level: ${Math.round(volume * 100)}%`}>
      {BAR_HEIGHTS.map((threshold, i) => {
        const active = volume >= threshold * 0.5;
        const scale = active ? Math.min(1, volume / threshold) : 0.15;
        return (
          <span
            key={i}
            className={`volume-bar${active ? " active" : ""}`}
            style={{ height: `${scale * 100}%` }}
          />
        );
      })}
    </span>
  );
}

export const PlaybackControlBar = memo(function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  micStatus,
  volume,
  practiceScope,
  repeatFlow,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording,
  onSetRepeatFlow,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled
}: PlaybackControlBarProps): JSX.Element {
  const isSentenceScope = practiceScope === "sentence";
  const isAuto = repeatFlow === "auto";
  const showRecord = isSentenceScope && !isAuto;
  const showReplay = isSentenceScope && hasRecording;
  const showHeadphoneHint = isAuto;

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
          className={isAuto && !isPlaying ? "btn secondary shadow-play-btn" : "btn secondary"}
          title={isAuto ? "Play + Record simultaneously" : isPlaying ? "Pause" : "Play"}
          onClick={onToggleOriginal}
        >
          {getPlayLabel(isAuto, isPlaying)}
        </button>

        <MicStatusIndicator micStatus={micStatus} />

        {isRecording ? (
          <span className="rec-indicator" aria-label="Recording in progress">
            <span className="rec-dot" />
            REC
            <VolumeMeter volume={volume} />
          </span>
        ) : null}

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
