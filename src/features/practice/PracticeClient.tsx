"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PlaybackControlBar } from "@/components/PlaybackControlBar";
import { SegmentNavigator } from "@/components/SegmentNavigator";
import { WaveformCanvas } from "@/components/WaveformCanvas";
import {
  YouTubeSegmentPlayer,
  type YouTubeSegmentPlayerHandle,
} from "@/components/YouTubeSegmentPlayer";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useRecorder } from "@/hooks/useRecorder";
import { useRecordingPlayback } from "@/hooks/useRecordingPlayback";
import { useVAD } from "@/hooks/useVAD";
import { useLiveWaveform } from "@/hooks/useLiveWaveform";
import { useWaveform } from "@/hooks/useWaveform";
import { usePracticeActions } from "@/hooks/usePracticeActions";
import { fetchTranscriptSegments } from "@/lib/apiClient";
import {
  getLatestRecording,
  getPracticeSession,
  getRecordedSegmentIndices,
  mapSegments,
  saveSegmentsForTrack,
  updateProgress,
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
  const [freeRecordingReady, setFreeRecordingReady] = useState(false);
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
  const freeRecordingBlobRef = useRef<Blob | null>(null);
  const recorderRef = useRef<ReturnType<typeof useRecorder> | null>(null);

  const {
    currentIndex,
    playbackSpeed,
    isRecording,
    isPlaying,
    repeatFlow,
    microphoneError,
    playerError,
    transcriptHidden,
    toggleTranscriptHidden,
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
    resetForSession,
  } = usePracticeStore();

  const { peaks: waveformPeaks } = useWaveform(waveformBlob, 200);
  const recordingPlayback = useRecordingPlayback();

  const segments = session?.segments ?? [];
  segmentsRef.current = segments;
  const currentSegment = segments[currentIndex];
  const recordedCount = recordingReadySet.size;
  const totalCount = segments.length;
  const progressPct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  // --- Actions hook ---

  const actions = usePracticeActions({
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
    hasSession: Boolean(session),
    setLatestRecordingReady,
    setFreeRecordingReady,
    setRecordingReadySet,
    setWaveformBlob,
    autoAdvanceDelayMs: AUTO_ADVANCE_DELAY_MS,
  });

  // --- Recorder ---

  const recorder = useRecorder({
    onComplete: actions.onRecordingComplete,
    onError: (message) => {
      setMicrophoneError(message || t("micAccessError"));
    },
  });

  // Keep recorderRef in sync so usePracticeActions callbacks can access it
  recorderRef.current = recorder;

  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder.isRecording, setIsRecording]);

  // --- Session loading ---

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
          trackToken: initial.track.token,
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
        segments: usableSegments,
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

  // Auto-select all segments when switching to free mode
  useEffect(() => {
    if (repeatFlow === "free" && freeRange === null && segments.length > 0) {
      setFreeRange({ startIndex: 0, endIndex: segments.length - 1 });
    }
  }, [repeatFlow, freeRange, segments.length, setFreeRange]);

  // --- Live waveform ---

  const {
    peaks: livePeaks,
    peaksRef: livePeaksRef,
    subscribe: subscribeLivePeaks,
    clearPeaks: clearLivePeaks,
    isLive: isLiveWaveform,
    status: liveWaveformStatus,
    error: liveWaveformError,
  } = useLiveWaveform(recorder.stream, recorder.isRecording);

  useEffect(() => {
    clearLivePeaks();
  }, [currentIndex, clearLivePeaks]);

  const displayPeaks = livePeaks ?? waveformPeaks;
  const waveformProgress = isLiveWaveform
    ? 1
    : recordingPlayback.isPlaying
      ? recordingPlayback.progress
      : latestRecordingReady
        ? 1
        : 0;
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
    },
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

  // --- Shortcuts ---

  useShortcuts(actions.shortcutHandlers);

  // --- Render ---

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
          <p
            className={
              transcriptHidden ? "current-sentence current-sentence-blurred" : "current-sentence"
            }
          >
            {repeatFlow === "free" && freeSessionActive
              ? (segments[freeHighlightIndex]?.text ?? t("noSegment"))
              : (currentSegment?.text ?? t("noSegment"))}
          </p>
          {repeatFlow === "free" ? (
            <div className="progress-row">
              <span className="progress-pct">
                {freeRange &&
                !(freeRange.startIndex === 0 && freeRange.endIndex === segments.length - 1)
                  ? t("rangeInfo", {
                      start: freeRange.startIndex + 1,
                      end: freeRange.endIndex + 1,
                      count: freeRange.endIndex - freeRange.startIndex + 1,
                    })
                  : t("allSelected")}
              </span>
            </div>
          ) : (
            <div className="progress-row">
              <span className="progress-pct">
                {Math.min(currentIndex + 1, segments.length)} / {segments.length}
              </span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="progress-pct">{t("recorded", { count: recordedCount })}</span>
            </div>
          )}
        </div>

        {displayPeaks || isLiveWaveform ? (
          <div className="waveform-wrap">
            <WaveformCanvas
              peaks={displayPeaks}
              progress={waveformProgress}
              barColor={waveformBarColor}
              onSeek={waveformSeekable ? actions.handleWaveformSeek : undefined}
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
          hasRecording={repeatFlow === "free" ? freeRecordingReady : latestRecordingReady}
          micStatus={recorder.micStatus}
          repeatFlow={repeatFlow}
          onToggleOriginal={() => void actions.toggleOriginal()}
          onToggleRecording={() => void actions.toggleRecording()}
          onPlayRecording={() => void actions.playRecording()}
          onSetRepeatFlow={setRepeatFlow}
          onPrev={actions.goPrev}
          onNext={actions.goNext}
          prevDisabled={currentIndex <= 0}
          nextDisabled={currentIndex >= segments.length - 1}
          freeSessionActive={freeSessionActive}
          onStartFree={() => void actions.startFreeShadowing()}
          onStopFree={() => void actions.stopFreeShadowing()}
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
          onSelectSegment={actions.selectSegment}
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
