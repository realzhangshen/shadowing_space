import assert from "node:assert/strict";
import test from "node:test";
import { isStudyTimerRunning } from "@/features/practice/studyTimer";

test("isStudyTimerRunning returns true when page is focused and interaction is recent", () => {
  assert.equal(
    isStudyTimerRunning({
      isPageVisible: true,
      hasWindowFocus: true,
      isPlaying: false,
      isRecording: false,
      lastInteractionAt: 10_000,
      now: 60_000,
      idleTimeoutMs: 75_000,
    }),
    true,
  );
});

test("isStudyTimerRunning stays active while audio is playing or recording", () => {
  assert.equal(
    isStudyTimerRunning({
      isPageVisible: true,
      hasWindowFocus: true,
      isPlaying: true,
      isRecording: false,
      lastInteractionAt: 0,
      now: 120_000,
      idleTimeoutMs: 30_000,
    }),
    true,
  );

  assert.equal(
    isStudyTimerRunning({
      isPageVisible: true,
      hasWindowFocus: true,
      isPlaying: false,
      isRecording: true,
      lastInteractionAt: 0,
      now: 120_000,
      idleTimeoutMs: 30_000,
    }),
    true,
  );
});

test("isStudyTimerRunning returns false when page is hidden or unfocused", () => {
  assert.equal(
    isStudyTimerRunning({
      isPageVisible: false,
      hasWindowFocus: true,
      isPlaying: true,
      isRecording: true,
      lastInteractionAt: 100,
      now: 120_000,
      idleTimeoutMs: 30_000,
    }),
    false,
  );

  assert.equal(
    isStudyTimerRunning({
      isPageVisible: true,
      hasWindowFocus: false,
      isPlaying: true,
      isRecording: true,
      lastInteractionAt: 100,
      now: 120_000,
      idleTimeoutMs: 30_000,
    }),
    false,
  );
});

test("isStudyTimerRunning stops after idle timeout when there is no playback", () => {
  assert.equal(
    isStudyTimerRunning({
      isPageVisible: true,
      hasWindowFocus: true,
      isPlaying: false,
      isRecording: false,
      lastInteractionAt: 10_000,
      now: 100_001,
      idleTimeoutMs: 90_000,
    }),
    false,
  );
});
