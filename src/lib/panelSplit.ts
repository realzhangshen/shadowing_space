export const DEFAULT_SPLIT_RATIO = 0.58;
export const MIN_SPLIT_RATIO = 0.25;
export const MAX_SPLIT_RATIO = 0.75;
export const SPLIT_RATIO_STEP = 0.04;
export const STORAGE_KEY = "shadowing-space:practice-split-ratio";

/** Ratios are stored as 4-decimal fractions so pointer math cannot leak long floats. */
const RATIO_PRECISION = 10_000;

type SplitRect = {
  left: number;
  width: number;
};

function roundRatio(ratio: number): number {
  return Math.round(ratio * RATIO_PRECISION) / RATIO_PRECISION;
}

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return DEFAULT_SPLIT_RATIO;
  }

  return roundRatio(Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio)));
}

export function parseStoredSplitRatio(raw: string | null): number {
  if (raw === null) {
    return DEFAULT_SPLIT_RATIO;
  }

  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed < MIN_SPLIT_RATIO || parsed > MAX_SPLIT_RATIO) {
    return DEFAULT_SPLIT_RATIO;
  }

  return clampSplitRatio(parsed);
}

export function splitRatioFromPointer(clientX: number, rect: SplitRect): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(rect.left) || !Number.isFinite(rect.width)) {
    return DEFAULT_SPLIT_RATIO;
  }

  if (rect.width <= 0) {
    return DEFAULT_SPLIT_RATIO;
  }

  return clampSplitRatio((clientX - rect.left) / rect.width);
}

export function nextSplitRatioForKeyboard(current: number, key: string, step?: number): number {
  const base = clampSplitRatio(current);
  const delta = step === undefined || !Number.isFinite(step) || step <= 0 ? SPLIT_RATIO_STEP : step;

  if (key === "ArrowLeft") {
    return clampSplitRatio(base - delta);
  }

  if (key === "ArrowRight") {
    return clampSplitRatio(base + delta);
  }

  return base;
}

export function formatSplitColumns(ratio: number): { left: string; right: string } {
  const clamped = clampSplitRatio(ratio);
  const leftPercent = Math.round(clamped * 100);

  return {
    left: `${leftPercent}%`,
    right: `${100 - leftPercent}%`,
  };
}
