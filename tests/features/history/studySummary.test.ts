import assert from "node:assert/strict";
import test from "node:test";
import { formatStudyDuration, summarizeStudySessions } from "@/features/history/studySummary";
import type { StudySessionRecord } from "@/types/models";

function makeSession(
  overrides: Partial<StudySessionRecord> & Pick<StudySessionRecord, "id" | "dayKey">,
): StudySessionRecord {
  return {
    id: overrides.id,
    trackId: overrides.trackId ?? "track-1",
    videoId: overrides.videoId ?? "video-1",
    videoTitle: overrides.videoTitle ?? "Daily Speaking Drill",
    startedAt: overrides.startedAt ?? 1_000,
    endedAt: overrides.endedAt ?? 61_000,
    activeMs: overrides.activeMs ?? 60_000,
    dayKey: overrides.dayKey,
  };
}

test("summarizeStudySessions groups duration by day and video in descending order", () => {
  const sessions: StudySessionRecord[] = [
    makeSession({
      id: "session-1",
      dayKey: "2026-04-16",
      videoId: "video-1",
      videoTitle: "Daily Speaking Drill",
      activeMs: 420_000,
      endedAt: 2_000,
    }),
    makeSession({
      id: "session-2",
      dayKey: "2026-04-15",
      videoId: "video-2",
      videoTitle: "News Breakdown",
      activeMs: 300_000,
      endedAt: 1_500,
    }),
    makeSession({
      id: "session-3",
      dayKey: "2026-04-16",
      videoId: "video-2",
      videoTitle: "News Breakdown",
      activeMs: 180_000,
      endedAt: 1_800,
    }),
    makeSession({
      id: "session-4",
      dayKey: "2026-04-16",
      videoId: "video-1",
      videoTitle: "Daily Speaking Drill",
      activeMs: 120_000,
      endedAt: 2_400,
    }),
  ];

  const summary = summarizeStudySessions(sessions);

  assert.equal(summary.totalDurationMs, 1_020_000);
  assert.equal(summary.dayCount, 2);
  assert.equal(summary.latestSessionAt, 2_400);
  assert.deepEqual(summary.days, [
    {
      dayKey: "2026-04-16",
      totalDurationMs: 720_000,
      latestSessionAt: 2_400,
      videos: [
        {
          videoId: "video-1",
          videoTitle: "Daily Speaking Drill",
          totalDurationMs: 540_000,
          latestSessionAt: 2_400,
        },
        {
          videoId: "video-2",
          videoTitle: "News Breakdown",
          totalDurationMs: 180_000,
          latestSessionAt: 1_800,
        },
      ],
    },
    {
      dayKey: "2026-04-15",
      totalDurationMs: 300_000,
      latestSessionAt: 1_500,
      videos: [
        {
          videoId: "video-2",
          videoTitle: "News Breakdown",
          totalDurationMs: 300_000,
          latestSessionAt: 1_500,
        },
      ],
    },
  ]);
});

test("summarizeStudySessions ignores non-positive active durations", () => {
  const summary = summarizeStudySessions([
    makeSession({ id: "session-1", dayKey: "2026-04-16", activeMs: 0 }),
    makeSession({ id: "session-2", dayKey: "2026-04-16", activeMs: -1 }),
  ]);

  assert.equal(summary.totalDurationMs, 0);
  assert.equal(summary.dayCount, 0);
  assert.equal(summary.latestSessionAt, undefined);
  assert.deepEqual(summary.days, []);
});

test("formatStudyDuration returns a compact hour minute second label", () => {
  assert.equal(formatStudyDuration(45_000), "45s");
  assert.equal(formatStudyDuration(125_000), "2m 5s");
  assert.equal(formatStudyDuration(3_780_000), "1h 3m");
});
