import type { PracticeSessionRecord } from "@/types/models";

export type PracticeVideoSummary = {
  videoId: string;
  videoTitle: string;
  totalDurationMs: number;
  sessionCount: number;
  latestSessionAt: number;
};

export type PracticeDaySummary = {
  dayKey: string;
  totalDurationMs: number;
  sessionCount: number;
  latestSessionAt: number;
  videos: PracticeVideoSummary[];
};

export type PracticeSummary = {
  totalDurationMs: number;
  totalSessionCount: number;
  dayCount: number;
  latestSessionAt?: number;
  days: PracticeDaySummary[];
};

type MutableVideoSummary = PracticeVideoSummary;
type MutableDaySummary = Omit<PracticeDaySummary, "videos"> & {
  videos: Map<string, MutableVideoSummary>;
};

function compareNumbersDesc(a: number, b: number): number {
  return b - a;
}

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

export function summarizePracticeSessions(sessions: PracticeSessionRecord[]): PracticeSummary {
  let totalDurationMs = 0;
  let totalSessionCount = 0;
  let latestSessionAt: number | undefined;

  const days = new Map<string, MutableDaySummary>();

  for (const session of sessions) {
    if (session.durationMs <= 0) {
      continue;
    }

    totalDurationMs += session.durationMs;
    totalSessionCount += 1;
    latestSessionAt =
      latestSessionAt === undefined
        ? session.createdAt
        : Math.max(latestSessionAt, session.createdAt);

    let daySummary = days.get(session.dayKey);
    if (!daySummary) {
      daySummary = {
        dayKey: session.dayKey,
        totalDurationMs: 0,
        sessionCount: 0,
        latestSessionAt: session.createdAt,
        videos: new Map<string, MutableVideoSummary>(),
      };
      days.set(session.dayKey, daySummary);
    }

    daySummary.totalDurationMs += session.durationMs;
    daySummary.sessionCount += 1;
    daySummary.latestSessionAt = Math.max(daySummary.latestSessionAt, session.createdAt);

    let videoSummary = daySummary.videos.get(session.videoId);
    if (!videoSummary) {
      videoSummary = {
        videoId: session.videoId,
        videoTitle: session.videoTitle,
        totalDurationMs: 0,
        sessionCount: 0,
        latestSessionAt: session.createdAt,
      };
      daySummary.videos.set(session.videoId, videoSummary);
    }

    videoSummary.totalDurationMs += session.durationMs;
    videoSummary.sessionCount += 1;
    videoSummary.latestSessionAt = Math.max(videoSummary.latestSessionAt, session.createdAt);

    if (videoSummary.latestSessionAt === session.createdAt) {
      videoSummary.videoTitle = session.videoTitle;
    }
  }

  const daySummaries: PracticeDaySummary[] = Array.from(days.values())
    .sort((a, b) => compareStringsAsc(b.dayKey, a.dayKey))
    .map((day) => ({
      dayKey: day.dayKey,
      totalDurationMs: day.totalDurationMs,
      sessionCount: day.sessionCount,
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
    totalSessionCount,
    dayCount: daySummaries.length,
    latestSessionAt,
    days: daySummaries,
  };
}

export function formatPracticeDuration(durationMs: number): string {
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
