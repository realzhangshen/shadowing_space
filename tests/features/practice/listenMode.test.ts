import assert from "node:assert/strict";
import test from "node:test";
import { REPEAT_FLOW_ORDER, nextListenIndex, nextRepeatFlow } from "@/features/practice/listenMode";

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
