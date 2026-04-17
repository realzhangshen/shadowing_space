"use client";

import { memo, useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import {
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEP,
  formatPlaybackSpeed,
  parsePlaybackSpeedInput,
} from "@/features/practice/playbackSpeed";
import { SPEEDS, type PlaybackSpeed } from "@/store/practiceStore";

type PlaybackSpeedInputProps = {
  playbackSpeed: PlaybackSpeed;
  onChange: (speed: PlaybackSpeed) => void;
};

export const PlaybackSpeedInput = memo(function PlaybackSpeedInput({
  playbackSpeed,
  onChange,
}: PlaybackSpeedInputProps): JSX.Element {
  const t = useTranslations("PracticeClient");
  const [draft, setDraft] = useState(() => formatPlaybackSpeed(playbackSpeed));

  useEffect(() => {
    setDraft(formatPlaybackSpeed(playbackSpeed));
  }, [playbackSpeed]);

  const commit = useCallback(
    (rawValue: string) => {
      const nextSpeed = parsePlaybackSpeedInput(rawValue, playbackSpeed);
      onChange(nextSpeed);
      setDraft(formatPlaybackSpeed(nextSpeed));
    },
    [onChange, playbackSpeed],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit(event.currentTarget.value);
        event.currentTarget.blur();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft(formatPlaybackSpeed(playbackSpeed));
        event.currentTarget.blur();
      }
    },
    [commit, playbackSpeed],
  );

  return (
    <>
      <div className="actions-row speed-row">
        <span className="muted">{t("speed")}</span>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={playbackSpeed === speed ? "btn secondary active-speed" : "btn secondary"}
            aria-current={playbackSpeed === speed ? true : undefined}
            onClick={() => onChange(speed)}
          >
            {formatPlaybackSpeed(speed)}x
          </button>
        ))}
        <label className="speed-input-wrap">
          <span className="muted speed-input-label">{t("customSpeed")}</span>
          <div className="speed-input-shell">
            <input
              type="number"
              inputMode="decimal"
              min={MIN_PLAYBACK_SPEED}
              max={MAX_PLAYBACK_SPEED}
              step={PLAYBACK_SPEED_STEP}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={(event) => commit(event.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={t("speedInputLabel")}
            />
            <span aria-hidden="true">x</span>
          </div>
        </label>
      </div>
      <p className="muted speed-hint">
        {t("speedHint", {
          min: formatPlaybackSpeed(MIN_PLAYBACK_SPEED),
          max: formatPlaybackSpeed(MAX_PLAYBACK_SPEED),
          step: formatPlaybackSpeed(PLAYBACK_SPEED_STEP),
        })}
      </p>
    </>
  );
});
