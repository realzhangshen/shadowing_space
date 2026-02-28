"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ABPanel } from "@/components/ABPanel";
import { RecorderPanel } from "@/components/RecorderPanel";
import { SegmentNavigator } from "@/components/SegmentNavigator";
import { YouTubeSegmentPlayer, type YouTubeSegmentPlayerHandle } from "@/components/YouTubeSegmentPlayer";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useRecorder } from "@/hooks/useRecorder";
import { fetchTranscriptSegments } from "@/lib/apiClient";
import {
  getLatestRecording,
  getPracticeSession,
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

export function PracticeClient({ videoId, trackId }: PracticeClientProps): JSX.Element {
  const router = useRouter();

  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [latestRecordingReady, setLatestRecordingReady] = useState(false);

  const playerRef = useRef<YouTubeSegmentPlayerHandle | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingAudioUrlRef = useRef<string | null>(null);

  const {
    currentIndex,
    playbackMode,
    playbackSpeed,
    isRecording,
    microphoneError,
    playerError,
    setCurrentIndex,
    setPlaybackMode,
    setPlaybackSpeed,
    setIsRecording,
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
      console.log("[debug] loadSession", { videoId, trackId });
      const initial = await getPracticeSession(videoId, trackId);
      console.log("[debug] getPracticeSession result", {
        hasVideo: Boolean(initial.video),
        hasTrack: Boolean(initial.track),
        trackCount: initial.tracks.length,
        segmentCount: initial.segments.length,
        trackIds: initial.tracks.map((t) => t.id)
      });
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

  const playOriginal = useCallback(() => {
    if (!currentSegment) {
      return;
    }

    clearRecordingAudio();
    playerRef.current?.playSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [clearRecordingAudio, currentSegment, playbackSpeed, setPlaybackMode]);

  const toggleOriginal = useCallback(() => {
    if (!currentSegment) {
      return;
    }

    clearRecordingAudio();
    playerRef.current?.toggleSegment(currentSegment.startMs, currentSegment.endMs, playbackSpeed);
    setPlaybackMode("source");
  }, [clearRecordingAudio, currentSegment, playbackSpeed, setPlaybackMode]);

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

  const recorder = useRecorder({
    onComplete: async ({ blob, durationMs, mimeType }) => {
      if (!currentSegment) {
        return;
      }

      await saveLatestRecording({
        trackId,
        segmentIndex: currentSegment.index,
        blob,
        durationMs,
        mimeType
      });

      setLatestRecordingReady(true);
      setPlaybackMode("attempt");
    },
    onError: (message) => {
      setMicrophoneError(message);
    }
  });

  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder.isRecording, setIsRecording]);

  const toggleRecording = useCallback(async () => {
    setMicrophoneError(undefined);
    playerRef.current?.pause();

    if (recorder.isRecording) {
      await recorder.stop();
    } else {
      await recorder.start();
    }
  }, [recorder, setMicrophoneError]);

  const goPrev = useCallback(() => {
    setCurrentIndex(Math.max(0, currentIndex - 1));
  }, [currentIndex, setCurrentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex(Math.min(segments.length - 1, currentIndex + 1));
  }, [currentIndex, segments.length, setCurrentIndex]);

  const switchTrack = useCallback(
    (nextTrack: TrackRecord) => {
      router.push(`/practice/${videoId}/${encodeURIComponent(nextTrack.id)}`);
    },
    [router, videoId]
  );

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
      onNextSegment: goNext
    }),
    [goNext, goPrev, playOriginal, playRecording, toggleOriginal, toggleRecording]
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
        <Link className="btn secondary inline-btn" href="/">
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

            {session.tracks.length > 1 ? (
              <label className="field compact-field">
                <span>Switch Track</span>
                <select
                  value={trackId}
                  onChange={(event) => {
                    const selected = session.tracks.find((track) => track.id === event.target.value);
                    if (selected) {
                      switchTrack(selected);
                    }
                  }}
                >
                  {session.tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.label}
                      {track.isAutoGenerated ? " (auto)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="actions-row">
            <Link href="/history" className="btn secondary inline-btn">
              History
            </Link>
            <Link href="/" className="btn secondary inline-btn">
              Import
            </Link>
          </div>
        </div>

        <YouTubeSegmentPlayer videoId={session.video.youtubeVideoId} ref={playerRef} onPlayerError={setPlayerError} />

        <div className="actions-row">
          <button className="btn primary" type="button" onClick={toggleOriginal}>
            {playbackMode === "source" ? "Pause Sentence (Space)" : "Play Sentence (Space)"}
          </button>
          <button className="btn secondary" type="button" onClick={playOriginal}>
            Replay Sentence (A)
          </button>
        </div>

        <div className="actions-row speed-row">
          <span className="muted">Speed</span>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={playbackSpeed === speed ? "btn secondary active-speed" : "btn secondary"}
              onClick={() => setPlaybackSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {playerError ? <p className="error-text">{playerError}</p> : null}

        <SegmentNavigator
          segments={segments}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
          onPrev={goPrev}
          onNext={goNext}
        />
      </section>

      <aside className="side-panel">
        <RecorderPanel
          isRecording={isRecording}
          totalAttempts={latestRecordingReady ? 1 : 0}
          microphoneError={microphoneError}
          onToggleRecording={() => {
            void toggleRecording();
          }}
        />
        <ABPanel
          hasRecording={latestRecordingReady}
          onPlayOriginal={playOriginal}
          onPlayRecording={() => {
            void playRecording();
          }}
        />

        <section className="card">
          <h3>Shortcuts</h3>
          <ul className="shortcut-list">
            <li>Space: play/pause current sentence</li>
            <li>R: start/stop recording</li>
            <li>A: replay original</li>
            <li>B: replay my recording</li>
            <li>← / →: previous/next sentence</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
