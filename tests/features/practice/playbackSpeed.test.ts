import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PLAYBACK_SPEED,
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  formatPlaybackSpeed,
  normalizePlaybackSpeed,
  parsePlaybackSpeedInput,
} from "@/features/practice/playbackSpeed";

test("normalizePlaybackSpeed preserves fine-grained custom speeds", () => {
  assert.equal(normalizePlaybackSpeed(0.7), 0.7);
  assert.equal(normalizePlaybackSpeed(0.9), 0.9);
  assert.equal(normalizePlaybackSpeed(0.91), 0.9);
});

test("normalizePlaybackSpeed clamps speeds to supported bounds", () => {
  assert.equal(normalizePlaybackSpeed(0.1), MIN_PLAYBACK_SPEED);
  assert.equal(normalizePlaybackSpeed(3), MAX_PLAYBACK_SPEED);
  assert.equal(normalizePlaybackSpeed(Number.NaN), DEFAULT_PLAYBACK_SPEED);
});

test("parsePlaybackSpeedInput falls back safely and formatted values stay compact", () => {
  assert.equal(parsePlaybackSpeedInput("0.90", 1), 0.9);
  assert.equal(parsePlaybackSpeedInput("", 0.75), 0.75);
  assert.equal(parsePlaybackSpeedInput("abc", 1.25), 1.25);

  assert.equal(formatPlaybackSpeed(1), "1");
  assert.equal(formatPlaybackSpeed(1.5), "1.5");
  assert.equal(formatPlaybackSpeed(1.25), "1.25");
});
