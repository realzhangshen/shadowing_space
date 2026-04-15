"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatStudyDuration, summarizeStudySessions } from "@/features/history/studySummary";
import { Link, useRouter } from "@/i18n/navigation";
import {
  clearAllData,
  deleteRecordingsForVideo,
  deleteVideo,
  deleteVocabularyWord,
  listHistory,
  listStudySessions,
  listVocabularyWords,
} from "@/features/storage/repository";
import type { HistoryItem, StudySessionRecord, VocabularyRecord } from "@/types/models";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dayKey;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HistoryClient(): JSX.Element {
  const t = useTranslations("HistoryClient");
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyRecord[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [storageUsage, setStorageUsage] = useState<string | undefined>();
  const studySummary = summarizeStudySessions(studySessions);

  const refresh = useCallback(async () => {
    setError(undefined);
    setIsLoading(true);

    try {
      const [nextHistory, nextVocabulary, nextStudySessions] = await Promise.all([
        listHistory(),
        listVocabularyWords(),
        listStudySessions(),
      ]);
      setItems(nextHistory);
      setVocabularyItems(nextVocabulary);
      setStudySessions(nextStudySessions);

      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) {
          setStorageUsage(formatBytes(estimate.usage));
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("errorLoadHistory"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = async (videoId: string, title: string) => {
    if (!window.confirm(t("confirmDelete", { title }))) {
      return;
    }

    try {
      await deleteVideo(videoId);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("errorDeleteVideo"));
    }
  };

  const handleClearRecordings = async (videoId: string, title: string) => {
    if (!window.confirm(t("confirmClearRecordings", { title }))) {
      return;
    }

    try {
      await deleteRecordingsForVideo(videoId);
      await refresh();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : t("errorClearRecordings"));
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t("confirmReset"))) {
      return;
    }

    try {
      await clearAllData();
      await refresh();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : t("errorClearAll"));
    }
  };

  const handleDeleteWord = async (id: string) => {
    try {
      await deleteVocabularyWord(id);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("errorDeleteWord"));
    }
  };

  return (
    <section>
      <div className="dashboard-header">
        <div>
          <h2>{t("title")}</h2>
          <p className="muted">
            {t("subtitle")}
            {storageUsage ? ` · ${t("storage", { usage: storageUsage })}` : ""}
          </p>
        </div>
        <Link href="/import" className="btn primary inline-btn">
          {t("importNewVideo")}
        </Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <p className="muted">{t("loading")}</p> : null}

      {!isLoading && items.length === 0 ? (
        <div className="card empty-state">
          <h3>{t("welcomeTitle")}</h3>
          <p className="muted">{t("welcomeSubtitle")}</p>
          <Link href="/import" className="btn primary inline-btn">
            {t("importFirst")}
          </Link>
        </div>
      ) : null}

      <div className="dashboard-grid">
        {items.map((item) => {
          const progress = item.progress;
          const progressPct =
            item.segmentCount > 0 && progress
              ? Math.round(((progress.currentIndex + 1) / item.segmentCount) * 100)
              : 0;

          return (
            <article key={item.video.id} className="video-card">
              {item.video.thumbnailUrl ? (
                <img
                  className="video-card-thumb"
                  src={item.video.thumbnailUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="video-card-thumb video-card-thumb-placeholder" />
              )}

              <div className="video-card-body">
                <h3 className="video-card-title">{item.video.title}</h3>

                <p className="muted video-card-meta">
                  {item.activeTrack?.label ?? t("noTrack")}
                  {item.activeTrack?.isAutoGenerated ? t("autoSuffix") : ""}
                  {" · "}
                  {formatTime(item.video.createdAt)}
                </p>

                {item.segmentCount > 0 ? (
                  <div className="progress-row">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="progress-pct">{progressPct}%</span>
                  </div>
                ) : null}

                <p className="muted video-card-stats">
                  {progress
                    ? t("sentenceProgress", {
                        current: progress.currentIndex + 1,
                        total: item.segmentCount,
                      })
                    : t("sentenceCount", { count: item.segmentCount })}
                  {item.recordingCount > 0
                    ? ` · ${t("recordedStats", { count: item.recordingCount, size: formatBytes(item.recordingSizeBytes) })}`
                    : ""}
                </p>
              </div>

              <div className="video-card-actions">
                <button
                  className="btn primary"
                  type="button"
                  disabled={!item.activeTrack}
                  onClick={() => {
                    if (!item.activeTrack) {
                      return;
                    }
                    router.push(
                      `/practice/${item.video.id}/${encodeURIComponent(item.activeTrack.id)}`,
                    );
                  }}
                >
                  {t("continue")}
                </button>
                {item.recordingCount > 0 ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => void handleClearRecordings(item.video.id, item.video.title)}
                  >
                    {t("clearRecordings")}
                  </button>
                ) : null}
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => void handleDelete(item.video.id, item.video.title)}
                >
                  {t("delete")}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!isLoading && items.length > 0 ? (
        <section className="practice-dashboard-section">
          <div className="dashboard-header">
            <div>
              <h3>{t("practiceRecordTitle")}</h3>
              <p className="muted">
                {studySummary.totalDurationMs > 0
                  ? t("practiceRecordSubtitle", {
                      days: studySummary.dayCount,
                      duration: formatStudyDuration(studySummary.totalDurationMs),
                    })
                  : t("practiceRecordEmptySubtitle")}
              </p>
            </div>
          </div>

          {studySummary.totalDurationMs === 0 ? (
            <div className="card">
              <p className="muted">{t("practiceRecordEmpty")}</p>
            </div>
          ) : (
            <>
              <div className="practice-summary-grid">
                <article className="card practice-summary-card">
                  <p className="practice-summary-label">{t("practiceSummaryTime")}</p>
                  <p className="practice-summary-value">
                    {formatStudyDuration(studySummary.totalDurationMs)}
                  </p>
                </article>
                <article className="card practice-summary-card">
                  <p className="practice-summary-label">{t("practiceSummaryDays")}</p>
                  <p className="practice-summary-value">{studySummary.dayCount}</p>
                </article>
                <article className="card practice-summary-card">
                  <p className="practice-summary-label">{t("practiceSummaryLatest")}</p>
                  <p className="practice-summary-value practice-summary-value-sm">
                    {studySummary.latestSessionAt
                      ? formatDateTime(studySummary.latestSessionAt)
                      : t("practiceNever")}
                  </p>
                </article>
              </div>

              <div className="practice-log-list">
                {studySummary.days.map((day) => (
                  <article key={day.dayKey} className="card practice-day-card">
                    <div className="practice-day-header">
                      <div>
                        <h4 className="practice-day-title">{formatDayLabel(day.dayKey)}</h4>
                      </div>
                      <p className="practice-day-total">
                        {formatStudyDuration(day.totalDurationMs)}
                      </p>
                    </div>

                    <div className="practice-day-videos">
                      {day.videos.map((video) => (
                        <div key={`${day.dayKey}:${video.videoId}`} className="practice-day-video">
                          <div>
                            <p className="practice-day-video-title">{video.videoTitle}</p>
                          </div>
                          <p className="practice-day-video-duration">
                            {formatStudyDuration(video.totalDurationMs)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <section className="vocabulary-dashboard-section">
          <div className="dashboard-header">
            <div>
              <h3>{t("notebookTitle")}</h3>
              <p className="muted">{t("notebookSubtitle", { count: vocabularyItems.length })}</p>
            </div>
          </div>

          {vocabularyItems.length === 0 ? (
            <div className="card">
              <p className="muted">{t("notebookEmpty")}</p>
            </div>
          ) : (
            <div className="vocabulary-dashboard-grid">
              {vocabularyItems.map((item) => (
                <article key={item.id} className="vocabulary-card">
                  <div className="vocabulary-card-body">
                    <p className="vocabulary-word">{item.word}</p>
                    <p className="muted vocabulary-card-meta">
                      {item.videoTitle}
                      {item.segmentIndex !== undefined
                        ? ` · ${t("wordSource", { number: item.segmentIndex + 1 })}`
                        : ""}
                      {` · ${formatTime(item.updatedAt)}`}
                    </p>
                    {item.segmentText ? (
                      <p className="vocabulary-context">{item.segmentText}</p>
                    ) : null}
                  </div>
                  <div className="vocabulary-card-actions">
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => void handleDeleteWord(item.id)}
                    >
                      {t("deleteWord")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {items.length > 0 ? (
        <p className="reset-link">
          <button type="button" className="text-btn muted" onClick={() => void handleReset()}>
            {t("resetAll")}
          </button>
        </p>
      ) : null}
    </section>
  );
}
