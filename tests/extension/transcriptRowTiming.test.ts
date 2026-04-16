import assert from "node:assert/strict";
import test from "node:test";
import { readStartMsFromRow, readEndMsFromRow } from "../../extension/lib/player-response.js";

// Mock "row" objects approximate YouTube's ytd-transcript-segment-renderer shape
// across Polymer variants we've observed. Tests pin the resolution order.

test("readStartMsFromRow prefers Polymer data.startMs (ms precision)", () => {
  const row = { data: { startMs: "82723" } };
  assert.equal(readStartMsFromRow(row), 82_723);
});

test("readStartMsFromRow reads nested data.transcriptSegmentRenderer.startMs", () => {
  const row = { data: { transcriptSegmentRenderer: { startMs: "91234" } } };
  assert.equal(readStartMsFromRow(row), 91_234);
});

test("readStartMsFromRow also tries __data for older Polymer builds", () => {
  const row = { __data: { startMs: 7_500 } };
  assert.equal(readStartMsFromRow(row), 7_500);
});

test("readStartMsFromRow falls back to cueGroupStartOffsetMs", () => {
  const row = { data: { cueGroupStartOffsetMs: "12345" } };
  assert.equal(readStartMsFromRow(row), 12_345);
});

test("readStartMsFromRow returns null when no known data path is available", () => {
  assert.equal(readStartMsFromRow(null), null);
  assert.equal(readStartMsFromRow({}), null);
  assert.equal(readStartMsFromRow({ data: {} }), null);
});

test("readEndMsFromRow prefers explicit endMs", () => {
  const row = { data: { startMs: "82000", endMs: "85500" } };
  assert.equal(readEndMsFromRow(row), 85_500);
});

test("readEndMsFromRow derives endMs from startMs + durationMs when endMs missing", () => {
  const row = {
    data: { transcriptSegmentRenderer: { startMs: "82000", durationMs: "3500" } },
  };
  assert.equal(readEndMsFromRow(row), 85_500);
});

test("readEndMsFromRow returns null when neither endMs nor durationMs is available", () => {
  assert.equal(readEndMsFromRow({ data: { startMs: "82000" } }), null);
  assert.equal(readEndMsFromRow(null), null);
});
