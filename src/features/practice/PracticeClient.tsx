"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PlaybackControlBar } from "@/components/PlaybackControlBar";
import { SegmentNavigator } from "@/components/SegmentNavigator";
import { YouTubeSegmentPlayer, type YouTubeSegmentPlayerHandle } from "@/components/YouTubeSegmentPlayer";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useRecorder } from "@/hooks/useRecorder";
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

export function PracticeClient({ videoId, trackId }: PracticeClientProps): JSX.Element {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [latestRecordingReady, setLatestRecordingReady] = useState(false);
  const [recordingReadySet, setRecordingReadySet] = useState<Set<number>>(new Set());
  const [resumeMessage, setResumeMessage] = useState<string | undefined>();

  const playerRef = useRef<YouTubeSegmentPlayerHandle | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingAudioUrlRef = useRef<string | null>(null);
  const recordingTargetRef = useRef<number>(0);
  const continuousTimerRef = useRef<number | null>(null);

  const {
    currentIndex,
    playbackMode,
    playbackSpeed,
    isRecording,
    isPlaying,
    practiceMethod,
    practiceScope,
    autoAdvance,
    microphoneError,
    playerError,
    transcriptHidden,
    toggleTranscriptHidden,
    setCurrentIndex,
    setPlaybackMode,
    setPlaybackSpeed,
    setIsRecording,
    setIsPlaying,
    setPracticeMethod,
    setPracticeScope,
    toggleAutoAdvance,
    setMicrophoneError,
    setPlayerError,
    resetForSession
  } = usePracticeStore();

  const segments = session?.segments ?? [];
  const currentSegment = segments[currentIndex];

  const clearRecordingAudio = useCallback(() => {
    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      recordingAudioRef.current = null;
    }

    if (recordingAudioUrlRef.current) {
      URL.revokeObjectURL(recordingAudioUrlRef.current);
      recordingAudioUrlRef.current = null;
    }
  }, []);

  const loadRecordingState = useCallback(async (nextTrackId: string, nextIndex: number) => {
    const recording = await getLatestRecording(nextTrackId, nextIndex);
    setLatestRecordingReady(Boolean(recording));
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

      // Load recording indices
      const indices = await getRecordedSegmentIndices(trackId);
      setRecordingReadySet(indices);

      // Show resume indicator
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
      clearRecordingAudio();
    };
  }, [clearRecordingAudio, loadSession]);

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

  // --- Recorder (must be declared before functions that reference it) ---

  const navigateToSegment = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      const seg = segments[index];
      if (!seg) return;
      clearRecordingAudio();
      playerRef.current?.playSegment(seg.startMs, seg.endMs, playbackSpeed);
      setPlaybackMode("source");
    },
    [clearRecordingAudio, playbackSpeed, segments, setCurrentIndex, setPlaybackMode]
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
      setRecordingReadySet((prev) => new Set(prev).add(targetSegment.index));

      const state = usePracticeStore.getState();
      if (state.practiceMethod !== "shadow") {
        setPlaybackMode("attempt");
      } else {
        setPlaybackMode("idle");
      }

      if (state.practiceMethod === "listen-repeat" && state.autoAdvance) {
        setTimeout(() => goNext(), AUTO_ADVANCE_DELAY_MS);
      }
    },
    onError: (message) => {
      setMicrophoneError(message);
    }
  });

  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder.isRecording, setIsRecording]);

  // Auto-stop recording when playback ends in shadowing mode, and clean up continuous tracking
  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;

    if (wasPlaying && !isPlaying) {
      if (continuousTimerRef.current) {
        window.clearInterval(continuousTimerRef.current);
        continuousTimerRef.current = null;
      }
      if (usePracticeStore.getState().practiceMethod === "shadow" && recorder.isRecording) {
        void recorder.stop();
      }
    }
  }, [isPlaying, recorder]);

  // --- Mode-specific functions ---

  const playOriginal = useCallback(() => {
    if (!currentSegment) {
      return;
    }

    clearRecordingAudio();
    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [clearRecordingAudio, currentSegment, playbackSpeed, setPlaybackMode]);

  const toggleRecording = useCallback(async () => {
    setMicrophoneError(undefined);
    if (usePracticeStore.getState().practiceMethod !== "shadow") {
      playerRef.current?.pause();
    }

    if (recorder.isRecording) {
      await recorder.stop();
    } else {
      recordingTargetRef.current = currentIndex;
      await recorder.start();
    }
  }, [currentIndex, recorder, setMicrophoneError]);

  const startShadowing = useCallback(async () => {
    if (!currentSegment) return;
    setMicrophoneError(undefined);
    clearRecordingAudio();

    // Start playback
    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");

    // Start recording simultaneously
    recordingTargetRef.current = currentIndex;
    await recorder.start();
  }, [clearRecordingAudio, currentIndex, currentSegment, playbackSpeed, recorder, setMicrophoneError, setPlaybackMode]);

  const stopContinuousTracking = useCallback(() => {
    if (continuousTimerRef.current) {
      window.clearInterval(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
  }, []);

  const startContinuousPlay = useCallback(() => {
    if (!segments.length) return;
    const startSeg = segments[currentIndex];
    const endSeg = segments[segments.length - 1];
    if (!startSeg || !endSeg) return;

    clearRecordingAudio();
    stopContinuousTracking();

    const onEnd = () => {
      stopContinuousTracking();
      setPlaybackMode("idle");
      if (recorder.isRecording) {
        void recorder.stop();
      }
    };

    playerRef.current?.playContinuous(startSeg.startMs, endSeg.endMs, playbackSpeed, onEnd);
    setPlaybackMode("source");

    // Poll current time to update segment index
    continuousTimerRef.current = window.setInterval(() => {
      const timeMs = playerRef.current?.getCurrentTimeMs() ?? 0;
      const state = usePracticeStore.getState();
      const segs = segments;
      for (let i = segs.length - 1; i >= 0; i--) {
        if (timeMs >= segs[i].startMs) {
          if (i !== state.currentIndex) {
            state.setCurrentIndex(i);
          }
          break;
        }
      }
    }, 250);

    // If shadow method, also start recording
    if (usePracticeStore.getState().practiceMethod === "shadow") {
      recordingTargetRef.current = currentIndex;
      void recorder.start();
    }
  }, [clearRecordingAudio, currentIndex, playbackSpeed, recorder, segments, setPlaybackMode, stopContinuousTracking]);

  // Clean up continuous tracking on unmount
  useEffect(() => {
    return () => stopContinuousTracking();
  }, [stopContinuousTracking]);

  // toggleOriginal: dispatches to shadowing/continuous/normal based on method + scope
  const toggleOriginal = useCallback(() => {
    if (!currentSegment) {
      return;
    }

    const state = usePracticeStore.getState();

    // If currently playing, pause (stop continuous tracking + recording if active)
    if (isPlaying) {
      playerRef.current?.pause();
      stopContinuousTracking();
      if (state.practiceMethod === "shadow" && recorder.isRecording) {
        void recorder.stop();
      }
      return;
    }

    // Scope "all": continuous play (optionally with recording if shadow)
    if (state.practiceScope === "all") {
      startContinuousPlay();
      return;
    }

    // Shadow method (sentence scope): play + record simultaneously
    if (state.practiceMethod === "shadow" && !recorder.isRecording) {
      void startShadowing();
      return;
    }

    clearRecordingAudio();
    playerRef.current?.toggleSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [clearRecordingAudio, currentSegment, isPlaying, playbackSpeed, recorder, setPlaybackMode, startContinuousPlay, startShadowing, stopContinuousTracking]);

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
    clearRecordingAudio();

    const url = URL.createObjectURL(recording.blob);
    const audio = new Audio(url);
    recordingAudioRef.current = audio;
    recordingAudioUrlRef.current = url;

    audio.onended = () => {
      clearRecordingAudio();
    };

    audio.play().catch(() => {
      setError("Failed to play your recording.");
      clearRecordingAudio();
    });

    setPlaybackMode("attempt");
    setLatestRecordingReady(true);
  }, [clearRecordingAudio, currentSegment, setPlaybackMode, trackId]);

  const selectSegment = useCallback(
    (index: number) => navigateToSegment(index),
    [navigateToSegment]
  );

  const toggleScope = useCallback(() => {
    const state = usePracticeStore.getState();
    state.setPracticeScope(state.practiceScope === "sentence" ? "all" : "sentence");
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
      onSetMethodListenRepeat: () => setPracticeMethod("listen-repeat"),
      onSetMethodShadow: () => setPracticeMethod("shadow"),
      onSetMethodListen: () => setPracticeMethod("listen"),
      onToggleScope: toggleScope
    }),
    [goNext, goPrev, playOriginal, playRecording, setPracticeMethod, toggleOriginal, toggleRecording, toggleScope]
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

        <PlaybackControlBar
          isPlaying={isPlaying}
          isRecording={isRecording}
          hasRecording={latestRecordingReady}
          practiceMethod={practiceMethod}
          practiceScope={practiceScope}
          autoAdvance={autoAdvance}
          onToggleOriginal={toggleOriginal}
          onToggleRecording={() => void toggleRecording()}
          onPlayRecording={() => void playRecording()}
          onSetPracticeMethod={setPracticeMethod}
          onSetPracticeScope={setPracticeScope}
          onToggleAutoAdvance={toggleAutoAdvance}
          onPrev={goPrev}
          onNext={goNext}
          prevDisabled={currentIndex <= 0}
          nextDisabled={currentIndex >= segments.length - 1}
        />

        {resumeMessage ? <p className="resume-indicator">{resumeMessage}</p> : null}

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

        <p className="muted shortcuts-hint">
          Space: play/pause · R: record · A: replay · B: playback · 1/2/3: method · S: shadow · C: scope · T: toggle text · &larr;/&rarr;: prev/next
        </p>

        <div aria-live="polite">
          {error ? <p className="error-text">{error}</p> : null}
          {playerError ? <p className="error-text">{playerError}</p> : null}
          {microphoneError ? <p className="error-text">{microphoneError}</p> : null}
        </div>
      </section>

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
