"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import type { MicStatus } from "@/hooks/useRecorder";
import type { RepeatFlow } from "@/store/practiceStore";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  micStatus: MicStatus;
  repeatFlow: RepeatFlow;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onSetRepeatFlow: (flow: RepeatFlow) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  freeSessionActive?: boolean;
  onStartFree?: () => void;
  onStopFree?: () => void;
};

export const PlaybackControlBar = memo(function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  micStatus,
  repeatFlow,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording,
  onSetRepeatFlow,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  freeSessionActive,
  onStartFree,
  onStopFree
}: PlaybackControlBarProps): JSX.Element {
  const t = useTranslations("PlaybackControlBar");
  const isAuto = repeatFlow === "auto";
  const isFree = repeatFlow === "free";
  const showRecord = !isAuto && !isFree;
  const showReplay = hasRecording && !isFree;
  const showHeadphoneHint = isAuto || isFree;

  const flows: { value: RepeatFlow; label: string }[] = [
    { value: "manual", label: t("manual") },
    { value: "auto", label: t("auto") },
    { value: "free", label: t("free") }
  ];

  function getPlayLabel(): string {
    if (isPlaying) return t("pause");
    if (isAuto) return t("shadow");
    return t("play");
  }

  function MicStatusIndicator(): JSX.Element | null {
    if (micStatus === "idle") return null;
    if (micStatus === "acquiring") {
      return <span className="mic-status acquiring">{t("preparing")}</span>;
    }
    if (micStatus === "error") {
      return <span className="mic-status error">{t("noMic")}</span>;
    }
    return <span className="mic-status active" aria-label="Microphone active">🎤</span>;
  }

  return (
    <div className="control-bar-wrap">
      {isFree ? (
        <div className="control-bar">
          <button
            type="button"
            className={freeSessionActive ? "btn primary recording free-start-btn" : "btn primary free-start-btn"}
            onClick={freeSessionActive ? onStopFree : onStartFree}
          >
            {freeSessionActive ? t("stopFree") : t("startFree")}
          </button>
          {!freeSessionActive && hasRecording ? (
            <button
              type="button"
              className="btn secondary"
              title={t("playRecordingTitle")}
              onClick={onPlayRecording}
            >
              {t("replay")}
            </button>
          ) : null}
          <MicStatusIndicator />
        </div>
      ) : (
        <>
          <div className="control-bar">
            <button type="button" className="btn secondary" onClick={onPrev} disabled={prevDisabled}>
              {t("prev")}
            </button>

            <button
              type="button"
              className={isAuto && !isPlaying ? "btn secondary shadow-play-btn" : "btn secondary"}
              title={isAuto ? t("playRecordTitle") : isPlaying ? t("pauseTitle") : t("playTitle")}
              onClick={onToggleOriginal}
            >
              {getPlayLabel()}
            </button>

            <button type="button" className="btn secondary" onClick={onNext} disabled={nextDisabled}>
              {t("next")}
            </button>
          </div>

          <div className="control-bar-secondary">
            {showRecord ? (
              <button
                type="button"
                className={isRecording ? "btn primary recording" : "btn primary"}
                title={isRecording ? t("stopRecordingTitle") : t("recordTitle")}
                aria-pressed={isRecording}
                onClick={onToggleRecording}
              >
                {isRecording ? t("stop") : t("record")}
              </button>
            ) : null}

            {showReplay ? (
              <button
                type="button"
                className="btn secondary"
                title={t("playRecordingTitle")}
                onClick={onPlayRecording}
              >
                {t("replay")}
              </button>
            ) : null}

            <MicStatusIndicator />
          </div>
        </>
      )}

      <div className="mode-settings">
        <div className="scope-toggle" role="radiogroup" aria-label={t("practiceFlow")}>
          {flows.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={repeatFlow === f.value}
              className={repeatFlow === f.value ? "scope-option active" : "scope-option"}
              disabled={freeSessionActive}
              onClick={() => onSetRepeatFlow(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {showHeadphoneHint ? (
          <span className="headphone-hint">{t("useHeadphones")}</span>
        ) : null}
      </div>
    </div>
  );
});
