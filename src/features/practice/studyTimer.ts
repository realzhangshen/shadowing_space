export const STUDY_IDLE_TIMEOUT_MS = 60_000;
export const STUDY_FLUSH_INTERVAL_MS = 15_000;

export function isStudyTimerRunning(params: {
  isPageVisible: boolean;
  hasWindowFocus: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  lastInteractionAt: number | null;
  now: number;
  idleTimeoutMs?: number;
}): boolean {
  const {
    isPageVisible,
    hasWindowFocus,
    isPlaying,
    isRecording,
    lastInteractionAt,
    now,
    idleTimeoutMs = STUDY_IDLE_TIMEOUT_MS,
  } = params;

  if (!isPageVisible || !hasWindowFocus) {
    return false;
  }

  if (isPlaying || isRecording) {
    return true;
  }

  if (lastInteractionAt === null) {
    return false;
  }

  return now - lastInteractionAt <= idleTimeoutMs;
}
