import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPracticeDuration,
  summarizePracticeSessions,
} from "@/features/history/practiceSummary";
import type { PracticeSessionRecord } from "@/types/models";

function makeSession(
  overrides: Partial<PracticeSessionRecord> & Pick<PracticeSessionRecord, "id" | "dayKey">,
): PracticeSessionRecord {
  return {
    id: overrides.id,
    trackId: overrides.trackId ?? "track-1",
    videoId: overrides.videoId ?? "video-1",
    videoTitle: overrides.videoTitle ?? "Daily Speaking Drill",
    durationMs: overrides.durationMs ?? 60_000,
    createdAt: overrides.createdAt ?? 1_000,
    dayKey: overrides.dayKey,
    kind: overrides.kind ?? "segment",
  };
}

test("summarizePracticeSessions groups records by day and video in descending order", () => {
  const sessions: PracticeSessionRecord[] = [
    makeSession({
      id: "session-1",
      dayKey: "2026-04-15",
      videoId: "video-1",
      videoTitle: "Daily Speaking Drill",
      durationMs: 180_000,
      createdAt: 1_500,
    }),
    makeSession({
      id: "session-2",
      dayKey: "2026-04-14",
      videoId: "video-2",
      videoTitle: "News Breakdown",
      durationMs: 240_000,
      createdAt: 900,
    }),
    makeSession({
      id: "session-3",
      dayKey: "2026-04-15",
      videoId: "video-2",
      videoTitle: "News Breakdown",
      durationMs: 90_000,
      createdAt: 1_200,
      kind: "free",
    }),
    makeSession({
      id: "session-4",
      dayKey: "2026-04-15",
      videoId: "video-1",
      videoTitle: "Daily Speaking Drill",
      durationMs: 120_000,
      createdAt: 1_700,
    }),
  ];

  const summary = summarizePracticeSessions(sessions);

  assert.equal(summary.totalDurationMs, 630_000);
  assert.equal(summary.totalSessionCount, 4);
  assert.equal(summary.dayCount, 2);
  assert.equal(summary.latestSessionAt, 1_700);
  assert.equal(summary.days.length, 2);

  assert.deepEqual(summary.days[0], {
    dayKey: "2026-04-15",
    totalDurationMs: 390_000,
    sessionCount: 3,
    latestSessionAt: 1_700,
    videos: [
      {
        videoId: "video-1",
        videoTitle: "Daily Speaking Drill",
        totalDurationMs: 300_000,
        sessionCount: 2,
        latestSessionAt: 1_700,
      },
      {
        videoId: "video-2",
        videoTitle: "News Breakdown",
        totalDurationMs: 90_000,
        sessionCount: 1,
        latestSessionAt: 1_200,
      },
    ],
  });

  assert.deepEqual(summary.days[1], {
    dayKey: "2026-04-14",
    totalDurationMs: 240_000,
    sessionCount: 1,
    latestSessionAt: 900,
    videos: [
      {
        videoId: "video-2",
        videoTitle: "News Breakdown",
        totalDurationMs: 240_000,
        sessionCount: 1,
        latestSessionAt: 900,
      },
    ],
  });
});

test("summarizePracticeSessions ignores non-positive durations", () => {
  const summary = summarizePracticeSessions([
    makeSession({ id: "session-1", dayKey: "2026-04-15", durationMs: 0 }),
    makeSession({ id: "session-2", dayKey: "2026-04-15", durationMs: -10 }),
  ]);

  assert.equal(summary.totalDurationMs, 0);
  assert.equal(summary.totalSessionCount, 0);
  assert.equal(summary.dayCount, 0);
  assert.equal(summary.latestSessionAt, undefined);
  assert.deepEqual(summary.days, []);
});

test("formatPracticeDuration returns a compact hour minute second label", () => {
  assert.equal(formatPracticeDuration(45_000), "45s");
  assert.equal(formatPracticeDuration(125_000), "2m 5s");
  assert.equal(formatPracticeDuration(3_780_000), "1h 3m");
});
