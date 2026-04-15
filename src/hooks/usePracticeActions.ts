"use client";

import { useCallback, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import type { YouTubeSegmentPlayerHandle } from "@/components/YouTubeSegmentPlayer";
import type { RecorderCompletePayload, useRecorder } from "@/hooks/useRecorder";
import type { useRecordingPlayback } from "@/hooks/useRecordingPlayback";
import { findHighlightIndex } from "@/lib/findHighlightIndex";
import {
  getLatestRecording,
  saveFreeRecording,
  saveLatestRecording,
} from "@/features/storage/repository";
import { usePracticeStore, type RepeatFlow } from "@/store/practiceStore";
import type { SegmentRecord } from "@/types/models";

type Recorder = ReturnType<typeof useRecorder>;

type PracticeActionsDeps = {
  trackId: string;
  segments: SegmentRecord[];
  segmentsRef: MutableRefObject<SegmentRecord[]>;
  playerRef: MutableRefObject<YouTubeSegmentPlayerHandle | null>;
  recorderRef: MutableRefObject<Recorder | null>;
  recordingPlayback: ReturnType<typeof useRecordingPlayback>;
  recordingTargetRef: MutableRefObject<number>;
  audioFinishedRef: MutableRefObject<boolean>;
  manualStopRef: MutableRefObject<boolean>;
  autoAdvanceTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  freeRecordingBlobRef: MutableRefObject<Blob | null>;
  waveformBlob: Blob | null;
  hasSession: boolean;
  setLatestRecordingReady: (ready: boolean) => void;
  setFreeRecordingReady: (ready: boolean) => void;
  setRecordingReadySet: (updater: (prev: Set<number>) => Set<number>) => void;
  setWaveformBlob: (blob: Blob | null) => void;
  autoAdvanceDelayMs: number;
};

export function usePracticeActions(deps: PracticeActionsDeps) {
  const {
    trackId,
    segments,
    segmentsRef,
    playerRef,
    recorderRef,
    recordingPlayback,
    recordingTargetRef,
    audioFinishedRef,
    manualStopRef,
    autoAdvanceTimerRef,
    freeRecordingBlobRef,
    waveformBlob,
    hasSession,
    setLatestRecordingReady,
    setFreeRecordingReady,
    setRecordingReadySet,
    setWaveformBlob,
    autoAdvanceDelayMs,
  } = deps;

  const {
    currentIndex,
    playbackSpeed,
    isPlaying,
    repeatFlow,
    freeSessionActive,
    setCurrentIndex,
    setPlaybackMode,
    setMicrophoneError,
    setFreeRange,
    setFreeHighlightIndex,
    setFreeSessionActive,
  } = usePracticeStore();

  // Stable refs for values that change frequently but are used inside callbacks
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const onRecordingComplete = useCallback(
    async ({ blob, durationMs, mimeType }: RecorderCompletePayload) => {
      const state = usePracticeStore.getState();
      const { segments: segs } = depsRef.current;
      const recorder = recorderRef.current;

      if (state.repeatFlow === "free") {
        freeRecordingBlobRef.current = blob;
        setWaveformBlob(blob);
        setFreeRecordingReady(true);

        const range = state.freeRange;
        if (range) {
          await saveFreeRecording({
            trackId,
            startSegmentIndex: range.startIndex,
            endSegmentIndex: range.endIndex,
            blob,
            mimeType,
            durationMs,
            playbackSpeed: state.playbackSpeed,
          });
        }

        if (manualStopRef.current) {
          manualStopRef.current = false;
        }
        setPlaybackMode("idle");
        return;
      }

      const targetIndex = recordingTargetRef.current;
      const targetSegment = segs[targetIndex];
      if (!targetSegment) return;

      await saveLatestRecording({
        trackId,
        segmentIndex: targetSegment.index,
        blob,
        durationMs,
        mimeType,
      });

      setLatestRecordingReady(true);
      setWaveformBlob(blob);
      setRecordingReadySet((prev) => new Set(prev).add(targetSegment.index));

      if (manualStopRef.current) {
        manualStopRef.current = false;
        setPlaybackMode("idle");
        return;
      }

      if (state.repeatFlow === "auto") {
        setPlaybackMode("idle");
      } else {
        setPlaybackMode("attempt");
      }

      if (state.repeatFlow === "auto") {
        autoAdvanceTimerRef.current = setTimeout(() => {
          autoAdvanceTimerRef.current = null;
          const s = usePracticeStore.getState();
          const currentSegments = segmentsRef.current;
          const nextIdx = Math.min(currentSegments.length - 1, s.currentIndex + 1);
          if (nextIdx === s.currentIndex) return;

          setCurrentIndex(nextIdx);
          const nextSeg = currentSegments[nextIdx];
          if (!nextSeg) return;

          recordingPlayback.stop();
          audioFinishedRef.current = false;
          playerRef.current?.playSegment(nextSeg.startMs, nextSeg.endMs, s.playbackSpeed);
          setPlaybackMode("source");

          recordingTargetRef.current = nextIdx;
          void recorder?.start();
        }, autoAdvanceDelayMs);
      }
    },
    [
      trackId,
      recorderRef,
      segmentsRef,
      playerRef,
      recordingPlayback,
      recordingTargetRef,
      audioFinishedRef,
      manualStopRef,
      autoAdvanceTimerRef,
      freeRecordingBlobRef,
      setLatestRecordingReady,
      setFreeRecordingReady,
      setRecordingReadySet,
      setWaveformBlob,
      setCurrentIndex,
      setPlaybackMode,
      autoAdvanceDelayMs,
    ],
  );

  const navigateToSegment = useCallback(
    async (index: number) => {
      const recorder = recorderRef.current;
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (recorder?.isRecording) {
        manualStopRef.current = true;
        await recorder.stop();
      }
      setCurrentIndex(index);
      const seg = segments[index];
      if (!seg) return;
      recordingPlayback.stop();
      audioFinishedRef.current = false;
      playerRef.current?.playSegment(seg.startMs, seg.endMs, playbackSpeed);
      setPlaybackMode("source");
    },
    [
      recorderRef,
      recordingPlayback.stop,
      playbackSpeed,
      segments,
      setCurrentIndex,
      setPlaybackMode,
      autoAdvanceTimerRef,
      manualStopRef,
      playerRef,
      audioFinishedRef,
    ],
  );

  const goPrev = useCallback(() => {
    const newIndex = Math.max(0, currentIndex - 1);
    if (newIndex === currentIndex) return;
    void navigateToSegment(newIndex);
  }, [currentIndex, navigateToSegment]);

  const goNext = useCallback(() => {
    const newIndex = Math.min(segments.length - 1, currentIndex + 1);
    if (newIndex === currentIndex) return;
    void navigateToSegment(newIndex);
  }, [currentIndex, navigateToSegment, segments.length]);

  const playOriginal = useCallback(async () => {
    const recorder = recorderRef.current;
    const currentSegment = segments[currentIndex];
    if (!currentSegment) return;

    if (recorder?.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    recordingPlayback.stop();
    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [
    recorderRef,
    recordingPlayback.stop,
    segments,
    currentIndex,
    playbackSpeed,
    setPlaybackMode,
    manualStopRef,
    playerRef,
  ]);

  const startShadowing = useCallback(async () => {
    const recorder = recorderRef.current;
    const currentSegment = segments[currentIndex];
    if (!currentSegment) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();
    audioFinishedRef.current = false;

    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");

    recordingTargetRef.current = currentIndex;
    await recorder?.start();
  }, [
    recorderRef,
    recordingPlayback.stop,
    currentIndex,
    segments,
    playbackSpeed,
    setMicrophoneError,
    setPlaybackMode,
    audioFinishedRef,
    playerRef,
    recordingTargetRef,
  ]);

  const toggleRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    setMicrophoneError(undefined);

    if (recorder?.isRecording) {
      if (usePracticeStore.getState().repeatFlow === "manual") {
        playerRef.current?.pause();
      }
      await recorder.stop();
    } else {
      playerRef.current?.pause();
      recordingPlayback.stop();
      recordingTargetRef.current = currentIndex;
      await recorder?.start();
    }
  }, [
    currentIndex,
    recorderRef,
    recordingPlayback,
    setMicrophoneError,
    playerRef,
    recordingTargetRef,
  ]);

  const toggleOriginal = useCallback(async () => {
    const recorder = recorderRef.current;
    const currentSegment = segments[currentIndex];
    if (!currentSegment) return;

    if (isPlaying) {
      playerRef.current?.pause();
      if (recorder?.isRecording) {
        manualStopRef.current = true;
        void recorder.stop();
      }
      return;
    }

    if (recorder?.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    const state = usePracticeStore.getState();

    if (state.repeatFlow === "auto") {
      void startShadowing();
      return;
    }

    recordingPlayback.stop();
    audioFinishedRef.current = false;
    playerRef.current?.toggleSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [
    recorderRef,
    recordingPlayback.stop,
    segments,
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackMode,
    startShadowing,
    manualStopRef,
    playerRef,
    audioFinishedRef,
  ]);

  const handleWaveformSeek = useCallback(
    (fraction: number) => {
      if (!waveformBlob) return;
      playerRef.current?.pause();

      if (recordingPlayback.isPlaying) {
        recordingPlayback.seek(fraction);
      } else {
        recordingPlayback.play(waveformBlob);
        requestAnimationFrame(() => recordingPlayback.seek(fraction));
      }
      setPlaybackMode("attempt");
    },
    [recordingPlayback, setPlaybackMode, waveformBlob, playerRef],
  );

  const playRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (recorder?.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    if (repeatFlow === "free" && freeRecordingBlobRef.current) {
      playerRef.current?.pause();
      recordingPlayback.play(freeRecordingBlobRef.current);
      setPlaybackMode("attempt");
      return;
    }

    const currentSegment = segments[currentIndex];
    if (!currentSegment) return;

    const recording = await getLatestRecording(trackId, currentSegment.index);
    if (!recording) {
      setLatestRecordingReady(false);
      return;
    }

    playerRef.current?.pause();
    recordingPlayback.play(recording.blob);
    setPlaybackMode("attempt");
    setLatestRecordingReady(true);
  }, [
    recorderRef,
    recordingPlayback,
    segments,
    currentIndex,
    repeatFlow,
    setPlaybackMode,
    trackId,
    manualStopRef,
    playerRef,
    freeRecordingBlobRef,
    setLatestRecordingReady,
  ]);

  const selectSegment = useCallback(
    (index: number) => void navigateToSegment(index),
    [navigateToSegment],
  );

  const toggleRepeatFlow = useCallback(() => {
    const recorder = recorderRef.current;
    if (freeSessionActive) return;
    if (recorder?.isRecording) {
      manualStopRef.current = true;
      void recorder.stop();
    }
    const state = usePracticeStore.getState();
    const order: readonly RepeatFlow[] = ["manual", "auto", "free"];
    const idx = order.indexOf(state.repeatFlow);
    state.setRepeatFlow(order[(idx + 1) % order.length]);
  }, [freeSessionActive, recorderRef, manualStopRef]);

  const stopFreeShadowing = useCallback(async () => {
    const recorder = recorderRef.current;
    playerRef.current?.pause();

    if (recorder?.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    setFreeSessionActive(false);
  }, [recorderRef, setFreeSessionActive, manualStopRef, playerRef]);

  const startFreeShadowing = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!hasSession) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();

    const range = usePracticeStore.getState().freeRange ?? {
      startIndex: 0,
      endIndex: segments.length - 1,
    };
    if (!usePracticeStore.getState().freeRange) {
      setFreeRange(range);
    }

    const startSeg = segments[range.startIndex];
    const endSeg = segments[range.endIndex];
    if (!startSeg || !endSeg) return;

    const startMs = startSeg.startMs;
    const endMs = endSeg.endMs;
    const speed = usePracticeStore.getState().playbackSpeed;

    setFreeHighlightIndex(range.startIndex);
    freeRecordingBlobRef.current = null;
    setFreeRecordingReady(false);

    const started = await recorder?.start();
    if (!started) return;

    setFreeSessionActive(true);

    playerRef.current?.playFreeRange(
      startMs,
      endMs,
      speed,
      (currentMs) => {
        const state = usePracticeStore.getState();
        const r = state.freeRange;
        if (!r) return;
        const idx = findHighlightIndex(segmentsRef.current, currentMs, r.startIndex, r.endIndex);
        setFreeHighlightIndex(idx);
      },
      () => {
        void stopFreeShadowing();
      },
    );
  }, [
    hasSession,
    segments,
    segmentsRef,
    recorderRef,
    recordingPlayback,
    setMicrophoneError,
    setFreeRange,
    setFreeHighlightIndex,
    setFreeSessionActive,
    freeRecordingBlobRef,
    playerRef,
    stopFreeShadowing,
    setFreeRecordingReady,
  ]);

  const toggleFreeSession = useCallback(() => {
    if (repeatFlow !== "free") return;
    if (freeSessionActive) {
      void stopFreeShadowing();
    } else {
      void startFreeShadowing();
    }
  }, [repeatFlow, freeSessionActive, startFreeShadowing, stopFreeShadowing]);

  const shortcutHandlers = useMemo(
    () => ({
      onPlayOrPauseSource: () => {
        void toggleOriginal();
      },
      onToggleRecording: () => {
        void toggleRecording();
      },
      onPlaySource: () => {
        void playOriginal();
      },
      onPlayAttempt: () => {
        void playRecording();
      },
      onPrevSegment: goPrev,
      onNextSegment: goNext,
      onToggleTranscript: usePracticeStore.getState().toggleTranscriptHidden,
      onToggleRepeatFlow: toggleRepeatFlow,
      onToggleFreeSession: toggleFreeSession,
    }),
    [
      goNext,
      goPrev,
      playOriginal,
      playRecording,
      toggleOriginal,
      toggleRecording,
      toggleRepeatFlow,
      toggleFreeSession,
    ],
  );

  return {
    onRecordingComplete,
    navigateToSegment,
    goPrev,
    goNext,
    playOriginal,
    toggleRecording,
    toggleOriginal,
    handleWaveformSeek,
    playRecording,
    selectSegment,
    toggleRepeatFlow,
    startFreeShadowing,
    stopFreeShadowing,
    toggleFreeSession,
    startShadowing,
    shortcutHandlers,
  };
}
