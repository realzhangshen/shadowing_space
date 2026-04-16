import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PLAYBACK_SPEED,
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  YOUTUBE_SUPPORTED_PLAYBACK_RATES,
  formatPlaybackSpeed,
  normalizePlaybackSpeed,
  parsePlaybackSpeedInput,
  snapToSupportedPlaybackRate,
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

test("YOUTUBE_SUPPORTED_PLAYBACK_RATES includes the rates YouTube accepts", () => {
  assert.deepEqual([...YOUTUBE_SUPPORTED_PLAYBACK_RATES], [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
});

test("snapToSupportedPlaybackRate keeps values that are already supported", () => {
  assert.equal(snapToSupportedPlaybackRate(0.75, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 0.75);
  assert.equal(snapToSupportedPlaybackRate(1, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 1);
  assert.equal(snapToSupportedPlaybackRate(1.5, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 1.5);
});

test("snapToSupportedPlaybackRate snaps custom speeds to the nearest supported rate", () => {
  assert.equal(snapToSupportedPlaybackRate(0.7, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 0.75);
  assert.equal(snapToSupportedPlaybackRate(0.9, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 1);
  assert.equal(snapToSupportedPlaybackRate(1.1, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 1);
  assert.equal(snapToSupportedPlaybackRate(1.3, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 1.25);
  assert.equal(snapToSupportedPlaybackRate(1.6, YOUTUBE_SUPPORTED_PLAYBACK_RATES), 1.5);
});

test("snapToSupportedPlaybackRate falls back to the default when no rates are provided", () => {
  assert.equal(snapToSupportedPlaybackRate(0.75, []), DEFAULT_PLAYBACK_SPEED);
});
