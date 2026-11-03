import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  SPLIT_RATIO_STEP,
  STORAGE_KEY,
  clampSplitRatio,
  formatSplitColumns,
  nextSplitRatioForKeyboard,
  parseStoredSplitRatio,
  splitRatioFromPointer,
} from "@/lib/panelSplit";

test("split ratio constants keep the video pane dominant by default", () => {
  assert.equal(DEFAULT_SPLIT_RATIO, 0.58);
  assert.equal(MIN_SPLIT_RATIO, 0.25);
  assert.equal(MAX_SPLIT_RATIO, 0.75);
  assert.equal(SPLIT_RATIO_STEP, 0.04);
  assert.equal(STORAGE_KEY, "shadowing-space:practice-split-ratio");
});

test("clampSplitRatio keeps ratios inside the supported range and falls back for invalid input", () => {
  assert.equal(clampSplitRatio(0.58), 0.58);
  assert.equal(clampSplitRatio(0.1), MIN_SPLIT_RATIO);
  assert.equal(clampSplitRatio(0.9), MAX_SPLIT_RATIO);
  assert.equal(clampSplitRatio(MIN_SPLIT_RATIO), MIN_SPLIT_RATIO);
  assert.equal(clampSplitRatio(MAX_SPLIT_RATIO), MAX_SPLIT_RATIO);
  assert.equal(clampSplitRatio(Number.NaN), DEFAULT_SPLIT_RATIO);
  assert.equal(clampSplitRatio(Number.POSITIVE_INFINITY), DEFAULT_SPLIT_RATIO);
  assert.equal(clampSplitRatio(Number.NEGATIVE_INFINITY), DEFAULT_SPLIT_RATIO);
});

test("parseStoredSplitRatio restores valid values and ignores garbage or out-of-range input", () => {
  assert.equal(parseStoredSplitRatio("0.62"), 0.62);
  assert.equal(parseStoredSplitRatio(" 0.42 "), 0.42);
  assert.equal(parseStoredSplitRatio(null), DEFAULT_SPLIT_RATIO);
  assert.equal(parseStoredSplitRatio(""), DEFAULT_SPLIT_RATIO);
  assert.equal(parseStoredSplitRatio("not-a-number"), DEFAULT_SPLIT_RATIO);
  assert.equal(parseStoredSplitRatio("NaN"), DEFAULT_SPLIT_RATIO);
  assert.equal(parseStoredSplitRatio("0.1"), DEFAULT_SPLIT_RATIO);
  assert.equal(parseStoredSplitRatio("0.9"), DEFAULT_SPLIT_RATIO);
});

test("splitRatioFromPointer converts pointer position into a clamped ratio", () => {
  const rect = { left: 100, width: 1000 };

  assert.equal(splitRatioFromPointer(680, rect), 0.58);
  assert.equal(splitRatioFromPointer(0, rect), MIN_SPLIT_RATIO);
  assert.equal(splitRatioFromPointer(5000, rect), MAX_SPLIT_RATIO);
  assert.equal(splitRatioFromPointer(Number.NaN, rect), DEFAULT_SPLIT_RATIO);
  assert.equal(splitRatioFromPointer(680, { left: 0, width: 0 }), DEFAULT_SPLIT_RATIO);
});

test("nextSplitRatioForKeyboard steps with arrows and clamps at the bounds", () => {
  assert.equal(nextSplitRatioForKeyboard(0.58, "ArrowRight"), 0.62);
  assert.equal(nextSplitRatioForKeyboard(0.58, "ArrowLeft"), 0.54);
  assert.equal(nextSplitRatioForKeyboard(0.74, "ArrowRight"), MAX_SPLIT_RATIO);
  assert.equal(nextSplitRatioForKeyboard(0.26, "ArrowLeft"), MIN_SPLIT_RATIO);
  assert.equal(nextSplitRatioForKeyboard(0.58, "ArrowRight", 0.1), 0.68);
  assert.equal(nextSplitRatioForKeyboard(0.58, "ArrowLeft", 0.1), 0.48);
  assert.equal(nextSplitRatioForKeyboard(0.58, "Enter"), 0.58);
  assert.equal(nextSplitRatioForKeyboard(0.58, "a"), 0.58);
  assert.equal(nextSplitRatioForKeyboard(0.58, "ArrowRight", 0), 0.62);
  assert.equal(nextSplitRatioForKeyboard(0.9, "ArrowLeft"), MAX_SPLIT_RATIO - SPLIT_RATIO_STEP);
});

test("formatSplitColumns renders percentage widths that add up to 100%", () => {
  assert.deepEqual(formatSplitColumns(0.58), { left: "58%", right: "42%" });
  assert.deepEqual(formatSplitColumns(0.333), { left: "33%", right: "67%" });
  assert.deepEqual(formatSplitColumns(0.5), { left: "50%", right: "50%" });
  assert.deepEqual(formatSplitColumns(0.1), { left: "25%", right: "75%" });
  assert.deepEqual(formatSplitColumns(0.9), { left: "75%", right: "25%" });
  assert.deepEqual(formatSplitColumns(Number.NaN), { left: "58%", right: "42%" });
});
