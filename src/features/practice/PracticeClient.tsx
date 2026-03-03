"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import {
  getLatestRecording,
  getPracticeSession,
  getRecordedSegmentIndices,
  mapSegments,
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

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const RESUME_MESSAGE_TIMEOUT_MS = 3_000;
const AUTO_ADVANCE_DELAY_MS = 400;
const WAVEFORM_DEGRADE_HINT_DELAY_MS = 800;

export function PracticeClient({ videoId, trackId }: PracticeClientProps): JSX.Element {
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
    resetForSession
  } = usePracticeStore();

  const { peaks: waveformPeaks } = useWaveform(waveformBlob, 200);
  const recordingPlayback = useRecordingPlayback();

  const segments = session?.segments ?? [];
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
        throw new Error("No local session found. Please import the video again.");
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
        throw new Error("Caption track has no playable sentence.");
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
        setResumeMessage(`Resumed from sentence #${safeIndex + 1}`);
        setTimeout(() => setResumeMessage(undefined), RESUME_MESSAGE_TIMEOUT_MS);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load practice session.");
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadRecordingState, resetForSession, trackId, videoId]);

  useEffect(() => {
    void loadSession();

    return () => {
      recordingPlayback.stop();
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

  const navigateToSegment = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      const seg = segments[index];
      if (!seg) return;
      recordingPlayback.stop();
      audioFinishedRef.current = false;
      playerRef.current?.playSegment(seg.startMs, seg.endMs, playbackSpeed);
      setPlaybackMode("source");
    },
    [recordingPlayback.stop, playbackSpeed, segments, setCurrentIndex, setPlaybackMode]
  );

  const goPrev = useCallback(() => {
    const newIndex = Math.max(0, currentIndex - 1);
    if (newIndex === currentIndex) return;
    navigateToSegment(newIndex);
  }, [currentIndex, navigateToSegment]);

  const goNext = useCallback(() => {
    const newIndex = Math.min(segments.length - 1, currentIndex + 1);
    if (newIndex === currentIndex) return;
    navigateToSegment(newIndex);
  }, [currentIndex, navigateToSegment, segments.length]);

  const recorder = useRecorder({
    onComplete: async ({ blob, durationMs, mimeType }) => {
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

      // User-initiated stop: save recording but don't auto-advance
      if (manualStopRef.current) {
        manualStopRef.current = false;
        setPlaybackMode("idle");
        return;
      }

      const state = usePracticeStore.getState();

      // In auto mode, we skip "attempt" review — just advance
      // In manual mode, show the recording for review
      if (state.repeatFlow === "auto") {
        setPlaybackMode("idle");
      } else {
        setPlaybackMode("attempt");
      }

      // Auto-advance: play next + record simultaneously (unified shadow-style)
      if (state.repeatFlow === "auto") {
        setTimeout(() => {
          const s = usePracticeStore.getState();
          const nextIdx = Math.min(segments.length - 1, s.currentIndex + 1);
          if (nextIdx === s.currentIndex) return;

          setCurrentIndex(nextIdx);
          const nextSeg = segments[nextIdx];
          if (!nextSeg) return;

          recordingPlayback.stop();
          audioFinishedRef.current = false;
          playerRef.current?.playSegment(nextSeg.startMs, nextSeg.endMs, s.playbackSpeed);
          setPlaybackMode("source");

          // Always start recording with playback in auto mode
          recordingTargetRef.current = nextIdx;
          void recorder.start();
        }, AUTO_ADVANCE_DELAY_MS);
      }
    },
    onError: (message) => {
      setMicrophoneError(message);
    }
  });

  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder.isRecording, setIsRecording]);

  // --- Live waveform ---

  const {
    peaks: livePeaks,
    peaksRef: livePeaksRef,
    subscribe: subscribeLivePeaks,
    isLive: isLiveWaveform,
    status: liveWaveformStatus,
    error: liveWaveformError
  } = useLiveWaveform(
    recorder.stream,
    recorder.isRecording
  );

  // Display priority: live peaks during recording > decoded peaks for stored > nothing
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
    if (!liveWaveformError) {
      return;
    }
    console.debug("[PracticeClient] Live waveform unavailable:", liveWaveformError);
  }, [liveWaveformError]);

  // --- VAD ---

  const vadEnabled = recorder.isRecording && repeatFlow === "auto";

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
      // Mark that original audio has finished (unblocks VAD gate)
      audioFinishedRef.current = true;
    }
  }, [isPlaying]);

  // --- Mode-specific functions ---

  const playOriginal = useCallback(() => {
    if (!currentSegment) {
      return;
    }

    recordingPlayback.stop();
    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [recordingPlayback.stop, currentSegment, playbackSpeed, setPlaybackMode]);

  const toggleRecording = useCallback(async () => {
    setMicrophoneError(undefined);

    if (recorder.isRecording) {
      // In manual mode, pause playback when stopping recording
      if (usePracticeStore.getState().repeatFlow === "manual") {
        playerRef.current?.pause();
      }
      await recorder.stop();
    } else {
      recordingTargetRef.current = currentIndex;
      await recorder.start();
    }
  }, [currentIndex, recorder, setMicrophoneError]);

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

  // toggleOriginal: dispatches based on flow
  const toggleOriginal = useCallback(() => {
    if (!currentSegment) {
      return;
    }

    // If currently playing, pause (stop recording if active)
    if (isPlaying) {
      playerRef.current?.pause();
      if (recorder.isRecording) {
        manualStopRef.current = true;
        void recorder.stop();
      }
      return;
    }

    const state = usePracticeStore.getState();

    // Auto mode: play + record simultaneously
    if (state.repeatFlow === "auto" && !recorder.isRecording) {
      void startShadowing();
      return;
    }

    // Manual mode: just play the original
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
        // Small delay to let audio load before seeking
        requestAnimationFrame(() => recordingPlayback.seek(fraction));
      }
      setPlaybackMode("attempt");
    },
    [recordingPlayback, setPlaybackMode, waveformBlob]
  );

  const playRecording = useCallback(async () => {
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
  }, [recordingPlayback, currentSegment, setPlaybackMode, trackId]);

  const selectSegment = useCallback(
    (index: number) => navigateToSegment(index),
    [navigateToSegment]
  );

  const toggleRepeatFlow = useCallback(() => {
    const state = usePracticeStore.getState();
    state.setRepeatFlow(state.repeatFlow === "manual" ? "auto" : "manual");
  }, []);

  const shortcutHandlers = useMemo(
    () => ({
      onPlayOrPauseSource: toggleOriginal,
      onToggleRecording: () => {
        void toggleRecording();
      },
      onPlaySource: playOriginal,
      onPlayAttempt: () => {
        void playRecording();
      },
      onPrevSegment: goPrev,
      onNextSegment: goNext,
      onToggleTranscript: usePracticeStore.getState().toggleTranscriptHidden,
      onToggleRepeatFlow: toggleRepeatFlow
    }),
    [goNext, goPrev, playOriginal, playRecording, toggleOriginal, toggleRecording, toggleRepeatFlow]
  );

  useShortcuts(shortcutHandlers);

  if (isLoading) {
    return <p className="muted">Loading practice session...</p>;
  }

  if (!session) {
    return (
      <section className="card">
        <h2>Unable to Start Practice</h2>
        <p className="error-text">{error ?? "Unknown error"}</p>
        <Link className="btn secondary inline-btn" href="/import">
          Back to Import
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
              Track: {session.track.label}
              {session.track.isAutoGenerated ? " (auto)" : ""}
            </p>
          </div>
        </div>

        <YouTubeSegmentPlayer
          videoId={session.video.youtubeVideoId}
          ref={playerRef}
          onPlayerError={setPlayerError}
          onPlayStateChange={setIsPlaying}
        />

        {/* Current sentence display — prominent, between video and controls */}
        <div className="current-sentence-wrap">
          <p className={transcriptHidden ? "current-sentence current-sentence-blurred" : "current-sentence"}>
            {currentSegment?.text ?? "No segment"}
          </p>
          <div className="progress-row">
            <span className="progress-pct">
              {Math.min(currentIndex + 1, segments.length)} / {segments.length}
            </span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-pct">{recordedCount} recorded</span>
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
            />
          </div>
        ) : null}
        {showWaveformUnavailableHint ? <p className="muted">录音正常，波形暂不可用</p> : null}

        <PlaybackControlBar
          isPlaying={isPlaying}
          isRecording={isRecording}
          hasRecording={latestRecordingReady}
          micStatus={recorder.micStatus}
          repeatFlow={repeatFlow}
          onToggleOriginal={toggleOriginal}
          onToggleRecording={() => void toggleRecording()}
          onPlayRecording={() => void playRecording()}
          onSetRepeatFlow={setRepeatFlow}
          onPrev={goPrev}
          onNext={goNext}
          prevDisabled={currentIndex <= 0}
          nextDisabled={currentIndex >= segments.length - 1}
        />

        <div className="actions-row speed-row">
          <span className="muted">Speed</span>
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
          Space: play/pause · R: record · A: replay · B: playback · M: manual/auto · T: toggle text · &larr;/&rarr;: prev/next
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
        />
      </section>
    </div>
  );
}
