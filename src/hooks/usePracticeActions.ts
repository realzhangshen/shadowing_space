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
import {
  buildContinuousListenWindow,
  findListenSegmentIndex,
  nextRepeatFlow,
  shouldUseContinuousListenNavigation,
} from "@/features/practice/listenMode";
import { capabilitiesFor } from "@/features/practice/modeCapabilities";
import { usePracticeStore } from "@/store/practiceStore";
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
    setLatestRecordingReady,
    setFreeRecordingReady,
    setRecordingReadySet,
    setWaveformBlob,
    autoAdvanceDelayMs,
  } = deps;

  const {
    setCurrentIndex,
    setPlaybackMode,
    setMicrophoneError,
    setFreeRange,
    setFreeHighlightIndex,
    setFreeSessionActive,
    setListenSessionActive,
  } = usePracticeStore();

  // Stable refs for values that change frequently but are used inside callbacks
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const onRecordingComplete = useCallback(
    async ({ blob, durationMs, mimeType }: RecorderCompletePayload) => {
      const state = usePracticeStore.getState();
      const { segments: segs } = depsRef.current;
      const recorder = recorderRef.current;
      const caps = capabilitiesFor(state.repeatFlow);

      if (caps.recordingStorage === "free") {
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

      switch (caps.postRecord) {
        case "continueSession":
          // Session keeps driving playback; do not switch into "attempt" review.
          return;
        case "autoAdvance": {
          setPlaybackMode("idle");
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
          return;
        }
        case "attempt":
          setPlaybackMode("attempt");
          return;
        case "idle":
          setPlaybackMode("idle");
          return;
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

  const playListenSegmentAt = useCallback(
    (index: number) => {
      const state = usePracticeStore.getState();
      if (!state.listenSessionActive) return;

      const currentSegments = segmentsRef.current;
      const window = buildContinuousListenWindow(currentSegments, index);
      if (!window) {
        setListenSessionActive(false);
        setPlaybackMode("idle");
        return;
      }

      audioFinishedRef.current = false;
      setCurrentIndex(window.startIndex);
      setPlaybackMode("source");
      playerRef.current?.playContinuous(
        window.startMs,
        window.endMs,
        state.playbackSpeed,
        (currentMs) => {
          if (!usePracticeStore.getState().listenSessionActive) {
            return;
          }

          const nextIndex = findListenSegmentIndex({
            segments: segmentsRef.current,
            window,
            currentMs,
          });
          setCurrentIndex(nextIndex);
        },
        () => {
          setCurrentIndex(window.endIndex);
          setListenSessionActive(false);
          setPlaybackMode("idle");

          const recorder = recorderRef.current;
          if (recorder?.isRecording) {
            // Keep the take attached to the sentence where recording started.
            manualStopRef.current = false;
            void recorder.stop();
          }
        },
      );
    },
    [
      segmentsRef,
      recorderRef,
      playerRef,
      audioFinishedRef,
      manualStopRef,
      setCurrentIndex,
      setPlaybackMode,
      setListenSessionActive,
    ],
  );

  const navigateToSegment = useCallback(
    async (index: number) => {
      const recorder = recorderRef.current;
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }

      const state = usePracticeStore.getState();
      const useContinuousListen = shouldUseContinuousListenNavigation({
        repeatFlow: state.repeatFlow,
      });

      if (useContinuousListen) {
        setListenSessionActive(true);
      } else if (state.listenSessionActive) {
        setListenSessionActive(false);
      }

      if (recorder?.isRecording) {
        manualStopRef.current = !useContinuousListen;
        await recorder.stop();
      }

      setCurrentIndex(index);
      const seg = segmentsRef.current[index];
      if (!seg) {
        if (useContinuousListen) {
          setListenSessionActive(false);
          setPlaybackMode("idle");
        }
        return;
      }

      recordingPlayback.stop();
      audioFinishedRef.current = false;
      if (useContinuousListen) {
        playListenSegmentAt(index);
      } else {
        playerRef.current?.playSegment(seg.startMs, seg.endMs, state.playbackSpeed);
        setPlaybackMode("source");
      }
    },
    [
      recorderRef,
      recordingPlayback,
      segmentsRef,
      setCurrentIndex,
      setPlaybackMode,
      setListenSessionActive,
      autoAdvanceTimerRef,
      manualStopRef,
      playerRef,
      audioFinishedRef,
      playListenSegmentAt,
    ],
  );

  const goPrev = useCallback(() => {
    const idx = usePracticeStore.getState().currentIndex;
    const newIndex = Math.max(0, idx - 1);
    if (newIndex === idx) return;
    void navigateToSegment(newIndex);
  }, [navigateToSegment]);

  const goNext = useCallback(() => {
    const idx = usePracticeStore.getState().currentIndex;
    const total = segmentsRef.current.length;
    const newIndex = Math.min(total - 1, idx + 1);
    if (newIndex === idx) return;
    void navigateToSegment(newIndex);
  }, [navigateToSegment, segmentsRef]);

  const playOriginal = useCallback(async () => {
    const recorder = recorderRef.current;
    const state = usePracticeStore.getState();
    const currentSegment = segmentsRef.current[state.currentIndex];
    if (!currentSegment) return;

    if (recorder?.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    recordingPlayback.stop();
    playerRef.current?.playSegment(
      currentSegment.startMs,
      currentSegment.endMs,
      state.playbackSpeed,
    );
    setPlaybackMode("source");
  }, [recorderRef, recordingPlayback, segmentsRef, setPlaybackMode, manualStopRef, playerRef]);

  const startShadowing = useCallback(async () => {
    const recorder = recorderRef.current;
    const state = usePracticeStore.getState();
    const currentSegment = segmentsRef.current[state.currentIndex];
    if (!currentSegment) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();
    audioFinishedRef.current = false;

    playerRef.current?.playSegment(
      currentSegment.startMs,
      currentSegment.endMs,
      state.playbackSpeed,
    );
    setPlaybackMode("source");

    recordingTargetRef.current = state.currentIndex;
    await recorder?.start();
  }, [
    recorderRef,
    recordingPlayback,
    segmentsRef,
    setMicrophoneError,
    setPlaybackMode,
    audioFinishedRef,
    playerRef,
    recordingTargetRef,
  ]);

  const toggleRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    setMicrophoneError(undefined);

    const state = usePracticeStore.getState();
    const caps = capabilitiesFor(state.repeatFlow);
    const inLiveSession = caps.hasSession && state.listenSessionActive;

    if (recorder?.isRecording) {
      if (caps.pausesPlaybackOnRecord) {
        playerRef.current?.pause();
      }
      await recorder.stop();
    } else {
      if (!inLiveSession) {
        playerRef.current?.pause();
      }
      recordingPlayback.stop();
      recordingTargetRef.current = state.currentIndex;
      await recorder?.start();
    }
  }, [recorderRef, recordingPlayback, setMicrophoneError, playerRef, recordingTargetRef]);

  const toggleOriginal = useCallback(async () => {
    const recorder = recorderRef.current;
    const state = usePracticeStore.getState();
    const currentSegment = segmentsRef.current[state.currentIndex];
    if (!currentSegment) return;

    if (state.isPlaying) {
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

    if (capabilitiesFor(state.repeatFlow).postRecord === "autoAdvance") {
      void startShadowing();
      return;
    }

    recordingPlayback.stop();
    audioFinishedRef.current = false;
    playerRef.current?.toggleSegment(
      currentSegment.startMs,
      currentSegment.endMs,
      state.playbackSpeed,
    );
    setPlaybackMode("source");
  }, [
    recorderRef,
    recordingPlayback,
    segmentsRef,
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

    const state = usePracticeStore.getState();

    if (
      capabilitiesFor(state.repeatFlow).recordingStorage === "free" &&
      freeRecordingBlobRef.current
    ) {
      playerRef.current?.pause();
      recordingPlayback.play(freeRecordingBlobRef.current);
      setPlaybackMode("attempt");
      return;
    }

    const currentSegment = segmentsRef.current[state.currentIndex];
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
    segmentsRef,
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
    const state = usePracticeStore.getState();
    if (state.freeSessionActive || state.listenSessionActive) return;
    if (recorder?.isRecording) {
      manualStopRef.current = true;
      void recorder.stop();
    }
    state.setRepeatFlow(nextRepeatFlow(state.repeatFlow));
  }, [recorderRef, manualStopRef]);

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
    if (!depsRef.current.hasSession) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();

    const segs = segmentsRef.current;
    const existingRange = usePracticeStore.getState().freeRange;
    const range = existingRange ?? {
      startIndex: 0,
      endIndex: segs.length - 1,
    };
    if (!existingRange) {
      setFreeRange(range);
    }

    const startSeg = segs[range.startIndex];
    const endSeg = segs[range.endIndex];
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
    depsRef,
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
    const state = usePracticeStore.getState();
    if (state.repeatFlow !== "free") return;
    if (state.freeSessionActive) {
      void stopFreeShadowing();
    } else {
      void startFreeShadowing();
    }
  }, [startFreeShadowing, stopFreeShadowing]);

  const stopListenSession = useCallback(async () => {
    const recorder = recorderRef.current;
    setListenSessionActive(false);
    playerRef.current?.pause();
    if (recorder?.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }
    setPlaybackMode("idle");
  }, [recorderRef, playerRef, manualStopRef, setListenSessionActive, setPlaybackMode]);

  const startListenSession = useCallback(async () => {
    if (!depsRef.current.hasSession) return;
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();

    const startIdx = Math.min(usePracticeStore.getState().currentIndex, segs.length - 1);
    setCurrentIndex(startIdx);
    setListenSessionActive(true);
    playListenSegmentAt(startIdx);
  }, [
    depsRef,
    segmentsRef,
    recordingPlayback,
    setMicrophoneError,
    setCurrentIndex,
    setListenSessionActive,
    playListenSegmentAt,
  ]);

  const toggleListenSession = useCallback(() => {
    const state = usePracticeStore.getState();
    if (state.repeatFlow !== "listen") return;
    if (state.listenSessionActive) {
      void stopListenSession();
    } else {
      void startListenSession();
    }
  }, [startListenSession, stopListenSession]);

  const toggleSessionForMode = useCallback(() => {
    const flow = usePracticeStore.getState().repeatFlow;
    if (flow === "free") {
      toggleFreeSession();
    } else if (flow === "listen") {
      toggleListenSession();
    }
  }, [toggleFreeSession, toggleListenSession]);

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
      onToggleSession: toggleSessionForMode,
    }),
    [
      goNext,
      goPrev,
      playOriginal,
      playRecording,
      toggleOriginal,
      toggleRecording,
      toggleRepeatFlow,
      toggleSessionForMode,
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
    startListenSession,
    stopListenSession,
    toggleListenSession,
    startShadowing,
    shortcutHandlers,
  };
}
