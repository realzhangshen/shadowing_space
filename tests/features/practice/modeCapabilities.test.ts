import assert from "node:assert/strict";
import test from "node:test";
import { MODE_CAPABILITIES, capabilitiesFor } from "@/features/practice/modeCapabilities";

test("manual mode pauses playback on record and ends in attempt review", () => {
  const caps = capabilitiesFor("manual");
  assert.equal(caps.hasSession, false);
  assert.equal(caps.continuity, "none");
  assert.equal(caps.recordingStorage, "segment");
  assert.equal(caps.postRecord, "attempt");
  assert.equal(caps.pausesPlaybackOnRecord, true);
});

test("auto mode auto-advances after a take and does not pause playback on record", () => {
  const caps = capabilitiesFor("auto");
  assert.equal(caps.postRecord, "autoAdvance");
  assert.equal(caps.pausesPlaybackOnRecord, false);
  assert.equal(caps.continuity, "none");
});

test("free mode plays a range and owns its own recording storage", () => {
  const caps = capabilitiesFor("free");
  assert.equal(caps.hasSession, true);
  assert.equal(caps.recordingStorage, "free");
  assert.equal(caps.continuity, "range");
  assert.equal(caps.pausesPlaybackOnRecord, false);
});

test("listen mode plays segments sequentially and keeps the session alive after a take", () => {
  const caps = capabilitiesFor("listen");
  assert.equal(caps.hasSession, true);
  assert.equal(caps.continuity, "sequential");
  assert.equal(caps.recordingStorage, "segment");
  assert.equal(caps.postRecord, "continueSession");
});

test("MODE_CAPABILITIES covers every repeat flow exactly once", () => {
  const flows = Object.keys(MODE_CAPABILITIES).sort();
  assert.deepEqual(flows, ["auto", "free", "listen", "manual"]);
});
