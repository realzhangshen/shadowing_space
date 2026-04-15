import type { StudySessionRecord } from "@/types/models";

export type StudyVideoSummary = {
  videoId: string;
  videoTitle: string;
  totalDurationMs: number;
  latestSessionAt: number;
};

export type StudyDaySummary = {
  dayKey: string;
  totalDurationMs: number;
  latestSessionAt: number;
  videos: StudyVideoSummary[];
};

export type StudySummary = {
  totalDurationMs: number;
  dayCount: number;
  latestSessionAt?: number;
  days: StudyDaySummary[];
};

type MutableVideoSummary = StudyVideoSummary;
type MutableDaySummary = Omit<StudyDaySummary, "videos"> & {
  videos: Map<string, MutableVideoSummary>;
};

function compareNumbersDesc(a: number, b: number): number {
  return b - a;
}

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

export function summarizeStudySessions(sessions: StudySessionRecord[]): StudySummary {
  let totalDurationMs = 0;
  let latestSessionAt: number | undefined;
  const days = new Map<string, MutableDaySummary>();

  for (const session of sessions) {
    if (session.activeMs <= 0) {
      continue;
    }

    totalDurationMs += session.activeMs;
    latestSessionAt =
      latestSessionAt === undefined ? session.endedAt : Math.max(latestSessionAt, session.endedAt);

    let daySummary = days.get(session.dayKey);
    if (!daySummary) {
      daySummary = {
        dayKey: session.dayKey,
        totalDurationMs: 0,
        latestSessionAt: session.endedAt,
        videos: new Map<string, MutableVideoSummary>(),
      };
      days.set(session.dayKey, daySummary);
    }

    daySummary.totalDurationMs += session.activeMs;
    daySummary.latestSessionAt = Math.max(daySummary.latestSessionAt, session.endedAt);

    let videoSummary = daySummary.videos.get(session.videoId);
    if (!videoSummary) {
      videoSummary = {
        videoId: session.videoId,
        videoTitle: session.videoTitle,
        totalDurationMs: 0,
        latestSessionAt: session.endedAt,
      };
      daySummary.videos.set(session.videoId, videoSummary);
    }

    videoSummary.totalDurationMs += session.activeMs;
    videoSummary.latestSessionAt = Math.max(videoSummary.latestSessionAt, session.endedAt);

    if (videoSummary.latestSessionAt === session.endedAt) {
      videoSummary.videoTitle = session.videoTitle;
    }
  }

  const daySummaries = Array.from(days.values())
    .sort((a, b) => compareStringsAsc(b.dayKey, a.dayKey))
    .map((day) => ({
      dayKey: day.dayKey,
      totalDurationMs: day.totalDurationMs,
      latestSessionAt: day.latestSessionAt,
      videos: Array.from(day.videos.values()).sort((a, b) => {
        if (a.totalDurationMs !== b.totalDurationMs) {
          return compareNumbersDesc(a.totalDurationMs, b.totalDurationMs);
        }

        if (a.latestSessionAt !== b.latestSessionAt) {
          return compareNumbersDesc(a.latestSessionAt, b.latestSessionAt);
        }

        return compareStringsAsc(a.videoTitle, b.videoTitle);
      }),
    }));

  return {
    totalDurationMs,
    dayCount: daySummaries.length,
    latestSessionAt,
    days: daySummaries,
  };
}

export function formatStudyDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}
