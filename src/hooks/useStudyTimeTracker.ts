"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  STUDY_FLUSH_INTERVAL_MS,
  STUDY_IDLE_TIMEOUT_MS,
  isStudyTimerRunning,
} from "@/features/practice/studyTimer";
import { saveStudySessionChunk } from "@/features/storage/repository";

type UseStudyTimeTrackerParams = {
  enabled: boolean;
  trackId?: string;
  isPlaying: boolean;
  isRecording: boolean;
  idleTimeoutMs?: number;
  flushIntervalMs?: number;
};

export function useStudyTimeTracker(params: UseStudyTimeTrackerParams): void {
  const {
    enabled,
    trackId,
    isPlaying,
    isRecording,
    idleTimeoutMs = STUDY_IDLE_TIMEOUT_MS,
    flushIntervalMs = STUDY_FLUSH_INTERVAL_MS,
  } = params;

  const statusRef = useRef({ enabled, trackId, isPlaying, isRecording });
  statusRef.current = { enabled, trackId, isPlaying, isRecording };

  const activeTrackIdRef = useRef<string | undefined>(undefined);
  const pageVisibleRef = useRef(true);
  const hasWindowFocusRef = useRef(true);
  const lastInteractionAtRef = useRef<number | null>(null);
  const lastTickAtRef = useRef<number | null>(null);
  const pendingActiveMsRef = useRef(0);
  const pendingStartedAtRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const persistQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const flushPending = useCallback((endedAt: number) => {
    const currentTrackId = activeTrackIdRef.current;
    const activeMs = Math.round(pendingActiveMsRef.current);

    pendingActiveMsRef.current = 0;

    if (!currentTrackId || activeMs <= 0) {
      pendingStartedAtRef.current = null;
      return;
    }

    const startedAt = pendingStartedAtRef.current ?? Math.max(0, endedAt - activeMs);
    pendingStartedAtRef.current = null;

    persistQueueRef.current = persistQueueRef.current
      .then(() =>
        saveStudySessionChunk({
          trackId: currentTrackId,
          startedAt,
          endedAt,
          activeMs,
        }),
      )
      .then(() => undefined)
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("[useStudyTimeTracker] Failed to save study time:", error);
        }
      });
  }, []);

  const recompute = useCallback(
    (options?: {
      now?: number;
      markInteraction?: boolean;
      nextPageVisible?: boolean;
      nextHasWindowFocus?: boolean;
      flush?: boolean;
    }) => {
      const now = options?.now ?? Date.now();

      if (options?.nextPageVisible !== undefined) {
        pageVisibleRef.current = options.nextPageVisible;
      }

      if (options?.nextHasWindowFocus !== undefined) {
        hasWindowFocusRef.current = options.nextHasWindowFocus;
      }

      if (options?.markInteraction) {
        lastInteractionAtRef.current = now;
      }

      const previousTickAt = lastTickAtRef.current ?? now;
      if (isRunningRef.current && now > previousTickAt) {
        if (pendingStartedAtRef.current === null) {
          pendingStartedAtRef.current = previousTickAt;
        }

        pendingActiveMsRef.current += now - previousTickAt;
      }

      lastTickAtRef.current = now;

      const currentTrackId = activeTrackIdRef.current;
      isRunningRef.current =
        Boolean(currentTrackId) &&
        isStudyTimerRunning({
          isPageVisible: pageVisibleRef.current,
          hasWindowFocus: hasWindowFocusRef.current,
          isPlaying: statusRef.current.isPlaying,
          isRecording: statusRef.current.isRecording,
          lastInteractionAt: lastInteractionAtRef.current,
          now,
          idleTimeoutMs,
        });

      if (options?.flush || pendingActiveMsRef.current >= flushIntervalMs) {
        flushPending(now);
      }
    },
    [flushIntervalMs, flushPending, idleTimeoutMs],
  );

  const resetState = useCallback(
    (now: number, nextTrackId?: string) => {
      activeTrackIdRef.current = nextTrackId;
      pendingActiveMsRef.current = 0;
      pendingStartedAtRef.current = null;
      lastTickAtRef.current = now;
      lastInteractionAtRef.current = nextTrackId ? now : null;
      isRunningRef.current =
        Boolean(nextTrackId) &&
        isStudyTimerRunning({
          isPageVisible: pageVisibleRef.current,
          hasWindowFocus: hasWindowFocusRef.current,
          isPlaying: statusRef.current.isPlaying,
          isRecording: statusRef.current.isRecording,
          lastInteractionAt: lastInteractionAtRef.current,
          now,
          idleTimeoutMs,
        });
    },
    [idleTimeoutMs],
  );

  useEffect(() => {
    pageVisibleRef.current = document.visibilityState !== "hidden";
    hasWindowFocusRef.current = document.hasFocus();

    const now = Date.now();
    const nextTrackId = enabled ? trackId : undefined;
    const previousTrackId = activeTrackIdRef.current;

    if (previousTrackId && previousTrackId !== nextTrackId) {
      recompute({ now, flush: true });
    }

    if (!previousTrackId && nextTrackId) {
      lastInteractionAtRef.current = now;
    }

    resetState(now, nextTrackId);
  }, [enabled, trackId, recompute, resetState]);

  useEffect(() => {
    recompute({ now: Date.now() });
  }, [isPlaying, isRecording, recompute]);

  useEffect(() => {
    const handleInteraction = () => {
      if (!activeTrackIdRef.current) {
        return;
      }

      recompute({ now: Date.now(), markInteraction: true });
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState !== "hidden";
      recompute({
        now: Date.now(),
        nextPageVisible: isVisible,
        flush: !isVisible,
      });
    };

    const handleFocus = () => {
      recompute({
        now: Date.now(),
        nextHasWindowFocus: true,
        markInteraction: true,
      });
    };

    const handleBlur = () => {
      recompute({
        now: Date.now(),
        nextHasWindowFocus: false,
        flush: true,
      });
    };

    const handlePageHide = () => {
      recompute({
        now: Date.now(),
        nextPageVisible: false,
        flush: true,
      });
    };

    window.addEventListener("pointerdown", handleInteraction, true);
    window.addEventListener("keydown", handleInteraction, true);
    window.addEventListener("touchstart", handleInteraction, true);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", handleInteraction, true);
      window.removeEventListener("keydown", handleInteraction, true);
      window.removeEventListener("touchstart", handleInteraction, true);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [recompute]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      recompute({ now: Date.now(), flush: true });
    }, flushIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [flushIntervalMs, recompute]);

  useEffect(
    () => () => {
      recompute({
        now: Date.now(),
        nextPageVisible: false,
        nextHasWindowFocus: false,
        flush: true,
      });
    },
    [recompute],
  );
}
