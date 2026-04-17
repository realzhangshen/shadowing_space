"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PlaybackControlBar, type SessionControls } from "@/components/PlaybackControlBar";
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
import { useStudyTimeTracker } from "@/hooks/useStudyTimeTracker";
import { useWaveform } from "@/hooks/useWaveform";
import { usePracticeActions } from "@/hooks/usePracticeActions";
import { fetchTranscriptSegments } from "@/lib/apiClient";
import {
  deleteVocabularyWord,
  getLatestRecording,
  getPracticeSession,
  getRecordedSegmentIndices,
  listVocabularyWords,
  mapSegments,
  saveSegmentsForTrack,
  saveVocabularyWord,
  updateProgress,
} from "@/features/storage/repository";
import { PlaybackSpeedInput } from "@/features/practice/PlaybackSpeedInput";
import { VocabularyPanel } from "@/features/practice/VocabularyPanel";
import { cleanVocabularyText } from "@/features/vocabulary/words";
import { usePracticeStore } from "@/store/practiceStore";
import type { SegmentRecord, TrackRecord, VideoRecord, VocabularyRecord } from "@/types/models";

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

const EMPTY_SEGMENTS: SegmentRecord[] = [];
const RESUME_MESSAGE_TIMEOUT_MS = 3_000;
const AUTO_ADVANCE_DELAY_MS = 400;
const WAVEFORM_DEGRADE_HINT_DELAY_MS = 800;
const VOCAB_SOURCE_SELECTOR = "[data-vocabulary-source]";

function buildSessionControls(input: {
  repeatFlow: string;
  freeSessionActive: boolean;
  listenSessionActive: boolean;
  onStartFree: () => Promise<void> | void;
  onStopFree: () => Promise<void> | void;
  onStartListen: () => Promise<void> | void;
  onStopListen: () => Promise<void> | void;
}): SessionControls | null {
  if (input.repeatFlow === "free") {
    return {
      mode: "free",
      active: input.freeSessionActive,
      onStart: () => void input.onStartFree(),
      onStop: () => void input.onStopFree(),
    };
  }
  if (input.repeatFlow === "listen") {
    return {
      mode: "listen",
      active: input.listenSessionActive,
      onStart: () => void input.onStartListen(),
      onStop: () => void input.onStopListen(),
    };
  }
  return null;
}

function nodeToElement(node: Node | null): HTMLElement | null {
  if (!node) {
    return null;
  }

  return node instanceof HTMLElement ? node : node.parentElement;
}

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
  const [wordDraft, setWordDraft] = useState("");
  const [wordFeedback, setWordFeedback] = useState<string | undefined>();
  const [selectedWordSourceIndex, setSelectedWordSourceIndex] = useState<number | null>(null);
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyRecord[]>([]);
  const [playerReadyTick, setPlayerReadyTick] = useState(0);

  const practiceLayoutRef = useRef<HTMLDivElement | null>(null);
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
    setPlaybackSpeed: setPlaybackSpeedInStore,
    setIsRecording,
    setIsPlaying,
    setRepeatFlow,
    setMicrophoneError,
    setPlayerError,
    freeRange,
    freeHighlightIndex,
    freeSessionActive,
    listenSessionActive,
    setFreeRange,
    resetForSession,
  } = usePracticeStore();

  const { peaks: waveformPeaks } = useWaveform(waveformBlob, 200);
  const recordingPlayback = useRecordingPlayback();
  const stopRecordingPlayback = recordingPlayback.stop;

  const segments = session?.segments ?? EMPTY_SEGMENTS;
  segmentsRef.current = segments;
  const activeTrackId = session?.track.id ?? trackId;
  const displayedSegmentIndex =
    repeatFlow === "free" && freeSessionActive ? freeHighlightIndex : currentIndex;
  const displayedSegment = segments[displayedSegmentIndex];
  const recordedCount = recordingReadySet.size;
  const totalCount = segments.length;
  const progressPct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;
  const cleanedWordDraft = cleanVocabularyText(wordDraft);

  const actions = usePracticeActions({
    trackId: activeTrackId,
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

  useStudyTimeTracker({
    enabled: Boolean(session),
    trackId: session?.track.id ?? trackId,
    isPlaying,
    isRecording,
  });

  const loadRecordingState = useCallback(async (nextTrackId: string, nextIndex: number) => {
    const recording = await getLatestRecording(nextTrackId, nextIndex);
    setLatestRecordingReady(Boolean(recording));
    setWaveformBlob(recording?.blob ?? null);
  }, []);

  const loadVocabularyState = useCallback(async (nextTrackId: string) => {
    const entries = await listVocabularyWords({ trackId: nextTrackId });
    setVocabularyItems(entries);
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const initial = await getPracticeSession(videoId, trackId);
      if (!initial.video || !initial.track) {
        throw new Error(t("errorNoSession"));
      }

      const resolvedTrackId = initial.track.id;
      let usableSegments = initial.segments;
      if (usableSegments.length === 0) {
        const resolved = await fetchTranscriptSegments({
          videoId,
          trackToken: initial.track.token,
        });

        usableSegments = mapSegments(resolvedTrackId, resolved.segments);
        await saveSegmentsForTrack(resolvedTrackId, usableSegments);
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
      setWordDraft("");
      setSelectedWordSourceIndex(null);
      await loadRecordingState(resolvedTrackId, safeIndex);
      await loadVocabularyState(resolvedTrackId);

      const indices = await getRecordedSegmentIndices(resolvedTrackId);
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
  }, [loadRecordingState, loadVocabularyState, resetForSession, trackId, videoId, t]);

  useEffect(() => {
    void loadSession();

    return () => {
      stopRecordingPlayback();
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [loadSession, stopRecordingPlayback]);

  useEffect(() => {
    if (!session || !segments.length) {
      return;
    }

    const safeIndex = Math.min(currentIndex, segments.length - 1);
    void updateProgress(activeTrackId, safeIndex);
    void loadRecordingState(activeTrackId, safeIndex);
  }, [activeTrackId, currentIndex, loadRecordingState, segments.length, session]);

  useEffect(() => {
    const appliedSpeed = playerRef.current?.setPlaybackSpeed(playbackSpeed);
    if (appliedSpeed !== undefined && appliedSpeed !== playbackSpeed) {
      setPlaybackSpeedInStore(appliedSpeed);
    }
  }, [playbackSpeed, playerReadyTick, setPlaybackSpeedInStore]);

  // Auto-select all segments when switching to free mode
  useEffect(() => {
    if (repeatFlow === "free" && freeRange === null && segments.length > 0) {
      setFreeRange({ startIndex: 0, endIndex: segments.length - 1 });
    }
  }, [repeatFlow, freeRange, segments.length, setFreeRange]);

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

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const root = practiceLayoutRef.current;

      if (!selection || selection.isCollapsed || !root) {
        return;
      }

      const anchorElement = nodeToElement(selection.anchorNode);
      const sourceElement = anchorElement?.closest<HTMLElement>(VOCAB_SOURCE_SELECTOR);
      if (!sourceElement || !root.contains(sourceElement)) {
        return;
      }

      const nextWord = cleanVocabularyText(selection.toString());
      if (!nextWord) {
        return;
      }

      const segmentIndexRaw = sourceElement.getAttribute("data-segment-index");
      const parsedSegmentIndex =
        segmentIndexRaw === null ? Number.NaN : Number.parseInt(segmentIndexRaw, 10);
      const segmentIndex = Number.isNaN(parsedSegmentIndex) ? null : parsedSegmentIndex;

      setWordDraft(nextWord);
      setSelectedWordSourceIndex(segmentIndex);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const vadEnabled =
    recorder.isRecording &&
    !freeSessionActive &&
    (repeatFlow === "auto" || (repeatFlow === "listen" && listenSessionActive));

  useVAD({
    stream: recorder.stream,
    enabled: vadEnabled,
    audioFinishedRef,
    onSilenceDetected: () => {
      void recorder.stop();
    },
  });

  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;

    if (wasPlaying && !isPlaying) {
      audioFinishedRef.current = true;
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!wordFeedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWordFeedback(undefined);
    }, RESUME_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [wordFeedback]);

  const handleSaveWord = useCallback(async () => {
    if (!session || !cleanedWordDraft) {
      return;
    }

    try {
      const sourceIndex = selectedWordSourceIndex ?? displayedSegmentIndex;
      const sourceSegment = sourceIndex >= 0 ? segments[sourceIndex] : undefined;
      const { created } = await saveVocabularyWord({
        text: cleanedWordDraft,
        videoId: session.video.id,
        videoTitle: session.video.title,
        trackId: session.track.id,
        segmentIndex: sourceSegment?.index,
        segmentText: sourceSegment?.text,
      });

      await loadVocabularyState(session.track.id);
      setWordDraft("");
      setSelectedWordSourceIndex(null);
      setWordFeedback(
        created
          ? t("wordSaved", { word: cleanedWordDraft })
          : t("wordUpdated", { word: cleanedWordDraft }),
      );
      window.getSelection()?.removeAllRanges();
    } catch {
      setWordFeedback(t("wordSaveFailed"));
    }
  }, [
    cleanedWordDraft,
    displayedSegmentIndex,
    loadVocabularyState,
    segments,
    selectedWordSourceIndex,
    session,
    t,
  ]);

  const handleDeleteWord = useCallback(
    async (id: string) => {
      if (!session) {
        return;
      }

      try {
        await deleteVocabularyWord(id);
        await loadVocabularyState(session.track.id);
        setWordFeedback(t("wordDeleted"));
      } catch {
        setWordFeedback(t("wordDeleteFailed"));
      }
    },
    [loadVocabularyState, session, t],
  );

  const syncPlaybackSpeed = useCallback(
    (nextSpeed: number) => {
      if (usePracticeStore.getState().playbackSpeed === nextSpeed) {
        return;
      }
      setPlaybackSpeedInStore(nextSpeed);
    },
    [setPlaybackSpeedInStore],
  );

  useShortcuts(actions.shortcutHandlers);

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
    <div className="practice-layout" ref={practiceLayoutRef}>
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
          onReady={() => setPlayerReadyTick((value) => value + 1)}
          onPlaybackSpeedChange={syncPlaybackSpeed}
        />

        <div className="current-sentence-wrap">
          <p
            data-vocabulary-source="current"
            data-segment-index={displayedSegmentIndex}
            className={
              transcriptHidden ? "current-sentence current-sentence-blurred" : "current-sentence"
            }
          >
            {displayedSegment?.text ?? t("noSegment")}
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
          session={buildSessionControls({
            repeatFlow,
            freeSessionActive,
            listenSessionActive,
            onStartFree: actions.startFreeShadowing,
            onStopFree: actions.stopFreeShadowing,
            onStartListen: actions.startListenSession,
            onStopListen: actions.stopListenSession,
          })}
        />

        <PlaybackSpeedInput playbackSpeed={playbackSpeed} onChange={setPlaybackSpeedInStore} />

        <ErrorBoundary>
          <VocabularyPanel
            items={vocabularyItems}
            wordDraft={wordDraft}
            onWordDraftChange={setWordDraft}
            onSave={() => void handleSaveWord()}
            onDelete={(id) => void handleDeleteWord(id)}
            feedback={wordFeedback}
            canSave={Boolean(cleanedWordDraft)}
          />
        </ErrorBoundary>

        {resumeMessage ? <p className="resume-indicator">{resumeMessage}</p> : null}

        <p className="muted shortcuts-hint">
          {repeatFlow === "free"
            ? t("shortcutsHintFree")
            : repeatFlow === "listen"
              ? t("shortcutsHintListen")
              : t("shortcutsHint")}
        </p>

        <div aria-live="polite">
          {error ? <p className="error-text">{error}</p> : null}
          {playerError ? <p className="error-text">{playerError}</p> : null}
          {microphoneError ? <p className="error-text">{microphoneError}</p> : null}
        </div>
      </section>

      {/* Right panel: sentence list only */}
      <section className="card main-practice">
        <ErrorBoundary>
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
        </ErrorBoundary>
      </section>
    </div>
  );
}
