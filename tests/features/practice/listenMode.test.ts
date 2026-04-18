import assert from "node:assert/strict";
import test from "node:test";
import {
  REPEAT_FLOW_ORDER,
  buildContinuousListenWindow,
  findListenSegmentIndex,
  listenTransportLabelKey,
  nextListenIndex,
  nextRepeatFlow,
  shouldUseContinuousListenNavigation,
} from "@/features/practice/listenMode";

test("nextListenIndex advances to the next segment when more remain", () => {
  assert.equal(nextListenIndex({ currentIndex: 0, totalSegments: 3 }), 1);
  assert.equal(nextListenIndex({ currentIndex: 1, totalSegments: 3 }), 2);
});

test("nextListenIndex returns null when the current segment is the last one", () => {
  assert.equal(nextListenIndex({ currentIndex: 2, totalSegments: 3 }), null);
});

test("nextListenIndex returns null when there are no segments", () => {
  assert.equal(nextListenIndex({ currentIndex: 0, totalSegments: 0 }), null);
});

test("buildContinuousListenWindow plays from the selected sentence through the end", () => {
  const result = buildContinuousListenWindow(
    [
      { startMs: 1_000, endMs: 2_200 },
      { startMs: 2_600, endMs: 4_100 },
      { startMs: 4_300, endMs: 5_900 },
    ],
    1,
  );

  assert.deepEqual(result, {
    startIndex: 1,
    endIndex: 2,
    startMs: 2_600,
    endMs: 5_900,
  });
});

test("findListenSegmentIndex follows playback time so subtitles switch without restarting playback", () => {
  const segments = [
    { startMs: 1_000, endMs: 2_200 },
    { startMs: 2_600, endMs: 4_100 },
    { startMs: 4_300, endMs: 5_900 },
  ];
  const window = buildContinuousListenWindow(segments, 0);

  assert.ok(window);
  assert.equal(findListenSegmentIndex({ segments, window, currentMs: 1_000 }), 0);
  assert.equal(findListenSegmentIndex({ segments, window, currentMs: 2_599 }), 0);
  assert.equal(findListenSegmentIndex({ segments, window, currentMs: 2_600 }), 1);
  assert.equal(findListenSegmentIndex({ segments, window, currentMs: 4_299 }), 1);
  assert.equal(findListenSegmentIndex({ segments, window, currentMs: 4_300 }), 2);
});

test("shouldUseContinuousListenNavigation keeps previous and next jumps in continuous listen playback", () => {
  assert.equal(shouldUseContinuousListenNavigation({ repeatFlow: "listen" }), true);
  assert.equal(shouldUseContinuousListenNavigation({ repeatFlow: "manual" }), false);
  assert.equal(shouldUseContinuousListenNavigation({ repeatFlow: "auto" }), false);
  assert.equal(shouldUseContinuousListenNavigation({ repeatFlow: "free" }), false);
});

test("listenTransportLabelKey presents active listening as pause instead of stop", () => {
  assert.equal(listenTransportLabelKey({ listenSessionActive: true, isPlaying: false }), "pause");
  assert.equal(listenTransportLabelKey({ listenSessionActive: false, isPlaying: true }), "pause");
  assert.equal(listenTransportLabelKey({ listenSessionActive: false, isPlaying: false }), "play");
});

test("nextRepeatFlow rotates manual → auto → free → listen → manual", () => {
  assert.equal(nextRepeatFlow("manual"), "auto");
  assert.equal(nextRepeatFlow("auto"), "free");
  assert.equal(nextRepeatFlow("free"), "listen");
  assert.equal(nextRepeatFlow("listen"), "manual");
});

test("REPEAT_FLOW_ORDER exposes the listen mode so UI pickers can render it", () => {
  assert.ok(REPEAT_FLOW_ORDER.includes("listen"));
  assert.equal(new Set(REPEAT_FLOW_ORDER).size, REPEAT_FLOW_ORDER.length);
});
