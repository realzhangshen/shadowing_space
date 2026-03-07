"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PlaybackControlBar } from "@/components/PlaybackControlBar";
import { SegmentNavigator } from "@/components/SegmentNavigator";
import { WaveformCanvas } from "@/components/WaveformCanvas";
import { YouTubeSegmentPlayer, type YouTubeSegmentPlayerHandle } from "@/components/YouTubeSegmentPlayer";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useRecorder } from "@/hooks/useRecorder";
import { useRecordingPlayback } from "@/hooks/useRecordingPlayback";
import { useVAD } from "@/hooks/useVAD";
import { useLiveWaveform } from "@/hooks/useLiveWaveform";
import { useWaveform } from "@/hooks/useWaveform";
import { fetchTranscriptSegments } from "@/lib/apiClient";
import { findHighlightIndex } from "@/lib/findHighlightIndex";
import {
  getLatestRecording,
  getPracticeSession,
  getRecordedSegmentIndices,
  mapSegments,
  saveFreeRecording,
  saveLatestRecording,
  saveSegmentsForTrack,
  updateProgress
} from "@/features/storage/repository";
import { usePracticeStore } from "@/store/practiceStore";
import type { SegmentRecord, TrackRecord, VideoRecord } from "@/types/models";

type PracticeClientProps = {
  videoId: string;
  trackId: string;
};

type SessionState = {
  video: VideoRecord;
  track: TrackRecord;
  tracks: TrackRecord[];
  segments: SegmentRecord[];
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const RESUME_MESSAGE_TIMEOUT_MS = 3_000;
const AUTO_ADVANCE_DELAY_MS = 400;
const WAVEFORM_DEGRADE_HINT_DELAY_MS = 800;

export function PracticeClient({ videoId, trackId }: PracticeClientProps): JSX.Element {
  const t = useTranslations("PracticeClient");
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [latestRecordingReady, setLatestRecordingReady] = useState(false);
  const [recordingReadySet, setRecordingReadySet] = useState<Set<number>>(new Set());
  const [resumeMessage, setResumeMessage] = useState<string | undefined>();
  const [waveformBlob, setWaveformBlob] = useState<Blob | null>(null);
  const [showWaveformUnavailableHint, setShowWaveformUnavailableHint] = useState(false);

  const playerRef = useRef<YouTubeSegmentPlayerHandle | null>(null);
  const recordingTargetRef = useRef<number>(0);
  const audioFinishedRef = useRef(false);
  const manualStopRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentsRef = useRef<SegmentRecord[]>([]);

  const {
    currentIndex,
    playbackMode,
    playbackSpeed,
    isRecording,
    isPlaying,
    repeatFlow,
    microphoneError,
    playerError,
    transcriptHidden,
    toggleTranscriptHidden,
    setCurrentIndex,
    setPlaybackMode,
    setPlaybackSpeed,
    setIsRecording,
    setIsPlaying,
    setRepeatFlow,
    setMicrophoneError,
    setPlayerError,
    freeRange,
    freeHighlightIndex,
    freeSessionActive,
    setFreeRange,
    setFreeHighlightIndex,
    setFreeSessionActive,
    resetForSession
  } = usePracticeStore();

  const { peaks: waveformPeaks } = useWaveform(waveformBlob, 200);
  const recordingPlayback = useRecordingPlayback();

  const segments = session?.segments ?? [];
  segmentsRef.current = segments;
  const currentSegment = segments[currentIndex];
  const recordedCount = recordingReadySet.size;
  const totalCount = segments.length;
  const progressPct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  const loadRecordingState = useCallback(async (nextTrackId: string, nextIndex: number) => {
    const recording = await getLatestRecording(nextTrackId, nextIndex);
    setLatestRecordingReady(Boolean(recording));
    setWaveformBlob(recording?.blob ?? null);
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const initial = await getPracticeSession(videoId, trackId);
      if (!initial.video || !initial.track) {
        throw new Error(t("errorNoSession"));
      }

      let usableSegments = initial.segments;
      if (usableSegments.length === 0) {
        const resolved = await fetchTranscriptSegments({
          videoId,
          trackToken: initial.track.token
        });

        usableSegments = mapSegments(trackId, resolved.segments);
        await saveSegmentsForTrack(trackId, usableSegments);
      }

      if (usableSegments.length === 0) {
        throw new Error(t("errorNoSentence"));
      }

      const safeIndex = Math.min(initial.progress?.currentIndex ?? 0, usableSegments.length - 1);
      resetForSession(safeIndex);
      setSession({
        video: initial.video,
        track: initial.track,
        tracks: initial.tracks,
        segments: usableSegments
      });
      await loadRecordingState(trackId, safeIndex);

      const indices = await getRecordedSegmentIndices(trackId);
      setRecordingReadySet(indices);

      if (safeIndex > 0) {
        setResumeMessage(t("resumeMessage", { number: safeIndex + 1 }));
        setTimeout(() => setResumeMessage(undefined), RESUME_MESSAGE_TIMEOUT_MS);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("errorLoadSession"));
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadRecordingState, resetForSession, trackId, videoId, t]);

  useEffect(() => {
    void loadSession();

    return () => {
      recordingPlayback.stop();
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [recordingPlayback.stop, loadSession]);

  useEffect(() => {
    if (!session || !segments.length) {
      return;
    }

    const safeIndex = Math.min(currentIndex, segments.length - 1);
    void updateProgress(trackId, safeIndex);
    void loadRecordingState(trackId, safeIndex);
  }, [currentIndex, loadRecordingState, segments.length, session, trackId]);

  useEffect(() => {
    playerRef.current?.setPlaybackSpeed(playbackSpeed);
  }, [playbackSpeed]);

  // --- Recorder ---

  const recorder = useRecorder({
    onComplete: async ({ blob, durationMs, mimeType }) => {
      const state = usePracticeStore.getState();

      // Free mode: save as a single continuous recording
      if (state.repeatFlow === "free") {
        freeRecordingBlobRef.current = blob;
        setWaveformBlob(blob);
        setLatestRecordingReady(true);

        const range = state.freeRange;
        if (range) {
          await saveFreeRecording({
            trackId,
            startSegmentIndex: range.startIndex,
            endSegmentIndex: range.endIndex,
            blob,
            mimeType,
            durationMs,
            playbackSpeed: state.playbackSpeed
          });
        }

        if (manualStopRef.current) {
          manualStopRef.current = false;
        }
        setPlaybackMode("idle");
        return;
      }

      const targetIndex = recordingTargetRef.current;
      const targetSegment = segments[targetIndex];
      if (!targetSegment) {
        return;
      }

      await saveLatestRecording({
        trackId,
        segmentIndex: targetSegment.index,
        blob,
        durationMs,
        mimeType
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
          void recorder.start();
        }, AUTO_ADVANCE_DELAY_MS);
      }
    },
    onError: (message) => {
      setMicrophoneError(message || t("micAccessError"));
    }
  });

  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder.isRecording, setIsRecording]);

  const navigateToSegment = useCallback(
    async (index: number) => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (recorder.isRecording) {
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
    [recorder, recordingPlayback.stop, playbackSpeed, segments, setCurrentIndex, setPlaybackMode]
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

  // --- Live waveform ---

  const {
    peaks: livePeaks,
    peaksRef: livePeaksRef,
    subscribe: subscribeLivePeaks,
    clearPeaks: clearLivePeaks,
    isLive: isLiveWaveform,
    status: liveWaveformStatus,
    error: liveWaveformError
  } = useLiveWaveform(
    recorder.stream,
    recorder.isRecording
  );

  useEffect(() => {
    clearLivePeaks();
  }, [currentIndex, clearLivePeaks]);

  const displayPeaks = livePeaks ?? waveformPeaks;
  const waveformProgress = isLiveWaveform
    ? 1
    : recordingPlayback.isPlaying
      ? recordingPlayback.progress
      : latestRecordingReady ? 1 : 0;
  const waveformBarColor = isLiveWaveform ? "var(--primary)" : undefined;
  const waveformSeekable = !isLiveWaveform && latestRecordingReady && waveformBlob;

  useEffect(() => {
    if (!recorder.isRecording) {
      setShowWaveformUnavailableHint(false);
      return;
    }

    if (livePeaks || liveWaveformStatus !== "degraded") {
      setShowWaveformUnavailableHint(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowWaveformUnavailableHint(true);
    }, WAVEFORM_DEGRADE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [livePeaks, liveWaveformStatus, recorder.isRecording]);

  useEffect(() => {
    if (!liveWaveformError || process.env.NODE_ENV === "production") {
      return;
    }
    console.debug("[PracticeClient] Live waveform unavailable:", liveWaveformError);
  }, [liveWaveformError]);

  // --- VAD ---

  const vadEnabled = recorder.isRecording && repeatFlow === "auto" && !freeSessionActive;

  useVAD({
    stream: recorder.stream,
    enabled: vadEnabled,
    audioFinishedRef,
    onSilenceDetected: () => {
      void recorder.stop();
    }
  });

  // --- Playback-end effect ---

  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;

    if (wasPlaying && !isPlaying) {
      audioFinishedRef.current = true;
    }
  }, [isPlaying]);

  // --- Mode-specific functions ---

  const playOriginal = useCallback(async () => {
    if (!currentSegment) {
      return;
    }

    if (recorder.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    recordingPlayback.stop();
    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [recorder, recordingPlayback.stop, currentSegment, playbackSpeed, setPlaybackMode]);

  const toggleRecording = useCallback(async () => {
    setMicrophoneError(undefined);

    if (recorder.isRecording) {
      if (usePracticeStore.getState().repeatFlow === "manual") {
        playerRef.current?.pause();
      }
      await recorder.stop();
    } else {
      playerRef.current?.pause();
      recordingPlayback.stop();
      recordingTargetRef.current = currentIndex;
      await recorder.start();
    }
  }, [currentIndex, recorder, recordingPlayback, setMicrophoneError]);

  const startShadowing = useCallback(async () => {
    if (!currentSegment) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();
    audioFinishedRef.current = false;

    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");

    recordingTargetRef.current = currentIndex;
    await recorder.start();
  }, [recordingPlayback.stop, currentIndex, currentSegment, playbackSpeed, recorder, setMicrophoneError, setPlaybackMode]);

  const toggleOriginal = useCallback(async () => {
    if (!currentSegment) {
      return;
    }

    if (isPlaying) {
      playerRef.current?.pause();
      if (recorder.isRecording) {
        manualStopRef.current = true;
        void recorder.stop();
      }
      return;
    }

    if (recorder.isRecording) {
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
  }, [recordingPlayback.stop, currentSegment, isPlaying, playbackSpeed, recorder, setPlaybackMode, startShadowing]);

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
    [recordingPlayback, setPlaybackMode, waveformBlob]
  );

  const playRecording = useCallback(async () => {
    if (recorder.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    // Free mode: play the in-memory free recording blob directly
    if (repeatFlow === "free" && freeRecordingBlobRef.current) {
      playerRef.current?.pause();
      recordingPlayback.play(freeRecordingBlobRef.current);
      setPlaybackMode("attempt");
      return;
    }

    if (!currentSegment) {
      return;
    }

    const recording = await getLatestRecording(trackId, currentSegment.index);
    if (!recording) {
      setLatestRecordingReady(false);
      return;
    }

    playerRef.current?.pause();
    recordingPlayback.play(recording.blob);
    setPlaybackMode("attempt");
    setLatestRecordingReady(true);
  }, [recorder, recordingPlayback, currentSegment, repeatFlow, setPlaybackMode, trackId]);

  const selectSegment = useCallback(
    (index: number) => void navigateToSegment(index),
    [navigateToSegment]
  );

  const toggleRepeatFlow = useCallback(() => {
    if (freeSessionActive) return;
    if (recorder.isRecording) {
      manualStopRef.current = true;
      void recorder.stop();
    }
    const state = usePracticeStore.getState();
    const order: Array<"manual" | "auto" | "free"> = ["manual", "auto", "free"];
    const idx = order.indexOf(state.repeatFlow);
    state.setRepeatFlow(order[(idx + 1) % order.length]);
  }, [freeSessionActive, recorder]);

  const freeRecordingBlobRef = useRef<Blob | null>(null);

  const startFreeShadowing = useCallback(async () => {
    if (!session) return;
    setMicrophoneError(undefined);
    recordingPlayback.stop();

    const range = usePracticeStore.getState().freeRange ?? {
      startIndex: 0,
      endIndex: segments.length - 1
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

    const started = await recorder.start();
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
      }
    );
  }, [session, segments, recorder, recordingPlayback, setMicrophoneError, setFreeRange, setFreeHighlightIndex, setFreeSessionActive]);

  const stopFreeShadowing = useCallback(async () => {
    playerRef.current?.pause();

    if (recorder.isRecording) {
      manualStopRef.current = true;
      await recorder.stop();
    }

    setFreeSessionActive(false);
  }, [recorder, setFreeSessionActive]);

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
      onPlayOrPauseSource: () => { void toggleOriginal(); },
      onToggleRecording: () => { void toggleRecording(); },
      onPlaySource: () => { void playOriginal(); },
      onPlayAttempt: () => {
        void playRecording();
      },
      onPrevSegment: goPrev,
      onNextSegment: goNext,
      onToggleTranscript: usePracticeStore.getState().toggleTranscriptHidden,
      onToggleRepeatFlow: toggleRepeatFlow,
      onToggleFreeSession: toggleFreeSession
    }),
    [goNext, goPrev, playOriginal, playRecording, toggleOriginal, toggleRecording, toggleRepeatFlow, toggleFreeSession]
  );

  useShortcuts(shortcutHandlers);

  if (isLoading) {
    return <p className="muted">{t("loading")}</p>;
  }

  if (!session) {
    return (
      <section className="card">
        <h2>{t("unableToStart")}</h2>
        <p className="error-text">{error ?? t("unknownError")}</p>
        <Link className="btn secondary inline-btn" href="/import">
          {t("backToImport")}
        </Link>
      </section>
    );
  }

  return (
    <div className="practice-layout">
      {/* Left panel: video + current sentence + controls */}
      <section className="card main-practice">
        <div className="practice-head">
          <div>
            <h2>{session.video.title}</h2>
            <p className="muted">
              {t("track", { label: session.track.label })}
              {session.track.isAutoGenerated ? t("autoSuffix") : ""}
            </p>
          </div>
        </div>

        <YouTubeSegmentPlayer
          videoId={session.video.youtubeVideoId}
          ref={playerRef}
          onPlayerError={setPlayerError}
          onPlayStateChange={setIsPlaying}
        />

        <div className="current-sentence-wrap">
          <p className={transcriptHidden ? "current-sentence current-sentence-blurred" : "current-sentence"}>
            {repeatFlow === "free" && freeSessionActive
              ? (segments[freeHighlightIndex]?.text ?? t("noSegment"))
              : (currentSegment?.text ?? t("noSegment"))}
          </p>
          <div className="progress-row">
            <span className="progress-pct">
              {Math.min(currentIndex + 1, segments.length)} / {segments.length}
            </span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-pct">{t("recorded", { count: recordedCount })}</span>
          </div>
        </div>

        {(displayPeaks || isLiveWaveform) ? (
          <div className="waveform-wrap">
            <WaveformCanvas
              peaks={displayPeaks}
              progress={waveformProgress}
              barColor={waveformBarColor}
              onSeek={waveformSeekable ? handleWaveformSeek : undefined}
              livePeaksRef={isLiveWaveform ? livePeaksRef : undefined}
              subscribeLivePeaks={isLiveWaveform ? subscribeLivePeaks : undefined}
              mode={isLiveWaveform ? "scrolling" : "static"}
            />
          </div>
        ) : null}
        {showWaveformUnavailableHint ? <p className="muted">{t("waveformUnavailable")}</p> : null}

        <PlaybackControlBar
          isPlaying={isPlaying}
          isRecording={isRecording}
          hasRecording={latestRecordingReady}
          micStatus={recorder.micStatus}
          repeatFlow={repeatFlow}
          onToggleOriginal={() => void toggleOriginal()}
          onToggleRecording={() => void toggleRecording()}
          onPlayRecording={() => void playRecording()}
          onSetRepeatFlow={setRepeatFlow}
          onPrev={goPrev}
          onNext={goNext}
          prevDisabled={currentIndex <= 0}
          nextDisabled={currentIndex >= segments.length - 1}
          freeSessionActive={freeSessionActive}
          onStartFree={() => void startFreeShadowing()}
          onStopFree={() => void stopFreeShadowing()}
        />

        <div className="actions-row speed-row">
          <span className="muted">{t("speed")}</span>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={playbackSpeed === speed ? "btn secondary active-speed" : "btn secondary"}
              aria-current={playbackSpeed === speed ? true : undefined}
              onClick={() => setPlaybackSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        {resumeMessage ? <p className="resume-indicator">{resumeMessage}</p> : null}

        <p className="muted shortcuts-hint">
          {repeatFlow === "free" ? t("shortcutsHintFree") : t("shortcutsHint")}
        </p>

        <div aria-live="polite">
          {error ? <p className="error-text">{error}</p> : null}
          {playerError ? <p className="error-text">{playerError}</p> : null}
          {microphoneError ? <p className="error-text">{microphoneError}</p> : null}
        </div>
      </section>

      {/* Right panel: sentence list only */}
      <section className="card main-practice">
        <SegmentNavigator
          segments={segments}
          currentIndex={currentIndex}
          onSelectSegment={selectSegment}
          recordingReadySet={recordingReadySet}
          transcriptHidden={transcriptHidden}
          onToggleTranscriptHidden={toggleTranscriptHidden}
          freeMode={repeatFlow === "free"}
          freeRange={freeRange}
          freeHighlightIndex={freeHighlightIndex}
          freeSessionActive={freeSessionActive}
          onSetFreeRange={setFreeRange}
        />
      </section>
    </div>
  );
}
