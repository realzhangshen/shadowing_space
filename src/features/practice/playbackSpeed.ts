export const MIN_PLAYBACK_SPEED = 0.25;
export const MAX_PLAYBACK_SPEED = 2;
export const PLAYBACK_SPEED_STEP = 0.05;
export const DEFAULT_PLAYBACK_SPEED = 1;
export const DEFAULT_PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5] as const;
export const YOUTUBE_SUPPORTED_PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function roundToStep(value: number): number {
  return Math.round(value / PLAYBACK_SPEED_STEP) * PLAYBACK_SPEED_STEP;
}

export function normalizePlaybackSpeed(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYBACK_SPEED;
  }

  const bounded = Math.min(MAX_PLAYBACK_SPEED, Math.max(MIN_PLAYBACK_SPEED, value));
  return Number(roundToStep(bounded).toFixed(2));
}

export function parsePlaybackSpeedInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return normalizePlaybackSpeed(fallback);
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return normalizePlaybackSpeed(fallback);
  }

  return normalizePlaybackSpeed(parsed);
}

export function formatPlaybackSpeed(value: number): string {
  return normalizePlaybackSpeed(value)
    .toFixed(2)
    .replace(/\.?0+$/, "");
}

export function snapToSupportedPlaybackRate(
  requested: number,
  availableRates: readonly number[],
): number {
  if (!availableRates.length) {
    return DEFAULT_PLAYBACK_SPEED;
  }

  return availableRates.reduce((nearest, rate) =>
    Math.abs(rate - requested) < Math.abs(nearest - requested) ? rate : nearest,
  );
}
