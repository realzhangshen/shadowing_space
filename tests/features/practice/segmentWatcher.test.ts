import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SEGMENT_END_TOLERANCE_MS,
  hasReachedSegmentEnd,
  startSegmentWatcher,
} from "@/features/practice/segmentWatcher";

test("hasReachedSegmentEnd returns true once current time meets the end", () => {
  assert.equal(hasReachedSegmentEnd(1_000, 1_000), true);
  assert.equal(hasReachedSegmentEnd(1_500, 1_000), true);
});

test("hasReachedSegmentEnd accepts tolerance so near-misses still count as reached", () => {
  assert.equal(hasReachedSegmentEnd(980, 1_000), true); // within default 50ms tolerance
  assert.equal(hasReachedSegmentEnd(900, 1_000), false);
});

test("hasReachedSegmentEnd honors a custom tolerance", () => {
  assert.equal(hasReachedSegmentEnd(900, 1_000, 150), true);
  assert.equal(hasReachedSegmentEnd(999 - DEFAULT_SEGMENT_END_TOLERANCE_MS - 10, 999, 10), false);
});

test("startSegmentWatcher fires onReached exactly once when current time crosses end", async () => {
  let current = 0;
  let calls = 0;
  const watcher = startSegmentWatcher({
    getCurrentMs: () => current,
    endMs: 300,
    onReached: () => {
      calls += 1;
    },
    tickMs: 10,
  });

  await new Promise<void>((resolve) => {
    const step = (value: number, delay: number) =>
      new Promise<void>((r) => setTimeout(() => ((current = value), r()), delay));
    void step(100, 15)
      .then(() => step(300, 15))
      .then(() => setTimeout(resolve, 40));
  });

  watcher.cancel();
  assert.equal(calls, 1);
});

test("startSegmentWatcher cancel stops polling and suppresses onReached", async () => {
  let calls = 0;
  const watcher = startSegmentWatcher({
    getCurrentMs: () => 500,
    endMs: 300,
    onReached: () => {
      calls += 1;
    },
    tickMs: 10,
  });
  watcher.cancel();

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(calls, 0);
});
