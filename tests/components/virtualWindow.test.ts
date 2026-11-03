import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustScrollTopForMeasurements,
  buildItemOffsets,
  computeVisibleWindow,
  computeVisibleWindowByOffsets,
  computeWindowAroundIndex,
  indexAtOffset,
  isIndexInWindow,
  scrollOffsetForIndex,
  scrollOffsetForIndexByOffsets,
} from "@/components/virtualWindow";

test("computeVisibleWindow returns overscanned window around the scrolled-to row", () => {
  const w = computeVisibleWindow({
    scrollTop: 400,
    viewportHeight: 200,
    itemHeight: 50,
    totalCount: 100,
    overscan: 2,
  });
  // first visible = floor(400/50) = 8, visibleCount = ceil(200/50) = 4
  assert.equal(w.startIndex, 6);
  assert.equal(w.endIndex, 14);
});

test("computeVisibleWindow clamps to list bounds", () => {
  const near = computeVisibleWindow({
    scrollTop: 0,
    viewportHeight: 500,
    itemHeight: 50,
    totalCount: 8,
    overscan: 10,
  });
  assert.equal(near.startIndex, 0);
  assert.equal(near.endIndex, 7);
});

test("computeVisibleWindow falls back to full range when inputs are degenerate", () => {
  const w = computeVisibleWindow({
    scrollTop: 0,
    viewportHeight: 0,
    itemHeight: 40,
    totalCount: 5,
  });
  assert.equal(w.startIndex, 0);
  assert.equal(w.endIndex, 4);
});

test("isIndexInWindow inclusive on both bounds", () => {
  const w = { startIndex: 3, endIndex: 5 };
  assert.equal(isIndexInWindow(w, 2), false);
  assert.equal(isIndexInWindow(w, 3), true);
  assert.equal(isIndexInWindow(w, 5), true);
  assert.equal(isIndexInWindow(w, 6), false);
});

test("scrollOffsetForIndex centers the target row within the viewport", () => {
  const offset = scrollOffsetForIndex(10, 50, 200, 100);
  // target = 500; centered offset = 500 - (200-50)/2 = 500 - 75 = 425
  assert.equal(offset, 425);
});

test("scrollOffsetForIndex clamps to the top and bottom of the list", () => {
  assert.equal(scrollOffsetForIndex(0, 50, 200, 100), 0);
  assert.equal(scrollOffsetForIndex(99, 50, 200, 100), 100 * 50 - 200);
});

test("buildItemOffsets returns prefix-sum boundaries using measured heights and estimates", () => {
  const offsets = buildItemOffsets({
    totalCount: 4,
    measuredHeights: [40, undefined, 60, 30],
    estimatedHeight: 25,
  });
  assert.deepEqual(offsets, [0, 40, 65, 125, 155]);
});

test("buildItemOffsets falls back to the estimate for non-finite or non-positive measurements", () => {
  const offsets = buildItemOffsets({
    totalCount: 3,
    measuredHeights: [50, Number.NaN, -3],
    estimatedHeight: 20,
  });
  assert.deepEqual(offsets, [0, 50, 70, 90]);
});

test("buildItemOffsets handles empty counts and invalid estimates", () => {
  assert.deepEqual(buildItemOffsets({ totalCount: 0, estimatedHeight: 64 }), [0]);
  assert.deepEqual(buildItemOffsets({ totalCount: -5, estimatedHeight: 64 }), [0]);
  assert.deepEqual(buildItemOffsets({ totalCount: Number.NaN, estimatedHeight: 64 }), [0]);
  // A non-positive estimate still has to produce usable, monotonic offsets.
  assert.deepEqual(buildItemOffsets({ totalCount: 2, estimatedHeight: 0 }), [0, 1, 2]);
  assert.deepEqual(buildItemOffsets({ totalCount: 2, estimatedHeight: Number.NaN }), [0, 1, 2]);
});

test("indexAtOffset finds the row whose slot contains the offset", () => {
  const offsets = [0, 50, 120, 170];
  assert.equal(indexAtOffset(offsets, 0), 0);
  assert.equal(indexAtOffset(offsets, 49), 0);
  assert.equal(indexAtOffset(offsets, 50), 1);
  assert.equal(indexAtOffset(offsets, 119), 1);
  assert.equal(indexAtOffset(offsets, 120), 2);
  assert.equal(indexAtOffset(offsets, 169), 2);
  // Exactly one row tall
  assert.equal(indexAtOffset([0, 42], 0), 0);
});

test("indexAtOffset clamps at both ends and handles degenerate input", () => {
  assert.equal(indexAtOffset([0, 50, 120, 170], -10), 0);
  assert.equal(indexAtOffset([0, 50, 120, 170], 170), 2);
  assert.equal(indexAtOffset([0, 50, 120, 170], 1e9), 2);
  assert.equal(indexAtOffset([0, 50, 120, 170], Number.NaN), 0);
  assert.equal(indexAtOffset([], 100), 0);
  assert.equal(indexAtOffset([0], 100), 0);
});

test("computeVisibleWindowByOffsets derives the window from variable row offsets", () => {
  // Row heights: 40, 60, 50, 70, 30 => boundaries 0, 40, 100, 150, 220, 250.
  const offsets = [0, 40, 100, 150, 220, 250];
  const w = computeVisibleWindowByOffsets({
    scrollTop: 90,
    viewportHeight: 100,
    offsets,
    overscan: 1,
  });
  // top = row 1 (40..100) minus overscan 1 => 0, bottom = row 3 (150..220) plus 1 => 4
  assert.equal(w.startIndex, 0);
  assert.equal(w.endIndex, 4);

  const noOverscan = computeVisibleWindowByOffsets({
    scrollTop: 100,
    viewportHeight: 100,
    offsets,
    overscan: 0,
  });
  assert.equal(noOverscan.startIndex, 2);
  assert.equal(noOverscan.endIndex, 3);
});

test("computeVisibleWindowByOffsets clamps to list bounds and never inverts the window", () => {
  const offsets = [0, 40, 100, 150, 220, 250];
  const top = computeVisibleWindowByOffsets({
    scrollTop: 0,
    viewportHeight: 5000,
    offsets,
    overscan: 10,
  });
  assert.deepEqual(top, { startIndex: 0, endIndex: 4 });

  const bottom = computeVisibleWindowByOffsets({
    scrollTop: 5000,
    viewportHeight: 100,
    offsets,
    overscan: 0,
  });
  assert.deepEqual(bottom, { startIndex: 4, endIndex: 4 });

  // A tiny list can only produce row 0 in both directions.
  const single = computeVisibleWindowByOffsets({
    scrollTop: 5,
    viewportHeight: 100,
    offsets: [0, 42],
    overscan: 0,
  });
  assert.deepEqual(single, { startIndex: 0, endIndex: 0 });
});

test("computeVisibleWindowByOffsets falls back to the full range for degenerate inputs", () => {
  const offsets = [0, 40, 100, 150, 220, 250];
  assert.deepEqual(
    computeVisibleWindowByOffsets({ scrollTop: 0, viewportHeight: 0, offsets, overscan: 2 }),
    { startIndex: 0, endIndex: 4 },
  );
  assert.deepEqual(
    computeVisibleWindowByOffsets({ scrollTop: 0, viewportHeight: 100, offsets: [0], overscan: 2 }),
    { startIndex: 0, endIndex: 0 },
  );
  assert.deepEqual(
    computeVisibleWindowByOffsets({ scrollTop: 0, viewportHeight: 100, offsets: [], overscan: 2 }),
    { startIndex: 0, endIndex: 0 },
  );
});

test("scrollOffsetForIndexByOffsets centers variable-height rows", () => {
  // Row heights: 40, 60, 50, 70, 30 => row 2 starts at 100 and is 50px tall.
  const offsets = [0, 40, 100, 150, 220, 250];
  // 100 - (100 - 50) / 2 = 75
  assert.equal(scrollOffsetForIndexByOffsets(2, offsets, 100, 5), 75);
  // Row 0 cannot go above the top.
  assert.equal(scrollOffsetForIndexByOffsets(0, offsets, 100, 5), 0);
});

test("scrollOffsetForIndexByOffsets clamps to the top and bottom of the list", () => {
  const offsets = [0, 40, 100, 150, 220, 250];
  // Row 4 starts at 220 and is 30px tall: centered would be 185, but max scroll is 150.
  assert.equal(scrollOffsetForIndexByOffsets(4, offsets, 100, 5), 150);
});

test("scrollOffsetForIndexByOffsets handles degenerate input", () => {
  const offsets = [0, 40, 100, 150, 220, 250];
  assert.equal(scrollOffsetForIndexByOffsets(2, offsets, 100, 0), 0);
  assert.equal(scrollOffsetForIndexByOffsets(0, [], 100, 0), 0);
  // A zero-height viewport keeps the row top inside the list bounds.
  assert.equal(scrollOffsetForIndexByOffsets(2, offsets, 0, 5), 100);
  // Non-finite indices fall back to the first row.
  assert.equal(scrollOffsetForIndexByOffsets(Number.NaN, offsets, 100, 5), 0);
});

test("adjustScrollTopForMeasurements shifts scrollTop for rows above the viewport", () => {
  assert.equal(adjustScrollTopForMeasurements(500, 3, 20, 5), 520);
  assert.equal(adjustScrollTopForMeasurements(500, 3, -20, 5), 480);
});

test("adjustScrollTopForMeasurements ignores rows at or below the viewport start", () => {
  assert.equal(adjustScrollTopForMeasurements(500, 5, 20, 5), 500);
  assert.equal(adjustScrollTopForMeasurements(500, 8, -20, 5), 500);
});

test("adjustScrollTopForMeasurements guards against invalid input", () => {
  assert.equal(adjustScrollTopForMeasurements(5, 0, -40, 3), 0);
  assert.equal(adjustScrollTopForMeasurements(Number.NaN, 0, 12, 1), 12);
  assert.equal(adjustScrollTopForMeasurements(500, 2, Number.NaN, 3), 500);
});

test("computeWindowAroundIndex centers a viewport-sized window on the target row", () => {
  // viewportRows = ceil(689 / 64) = 11, span = 11 + 2 * 8 = 27 rows, half = 13
  const w = computeWindowAroundIndex({
    index: 50,
    totalCount: 128,
    viewportHeight: 689,
    estimatedHeight: 64,
    overscan: 8,
  });
  assert.deepEqual(w, { startIndex: 37, endIndex: 63 });
  assert.equal(w.endIndex - w.startIndex + 1, 27);
});

test("computeWindowAroundIndex clamps to the list bounds", () => {
  const base = { totalCount: 128, viewportHeight: 689, estimatedHeight: 64, overscan: 8 };
  // Near the top the window starts at row 0 and keeps its span.
  assert.deepEqual(computeWindowAroundIndex({ ...base, index: 2 }), {
    startIndex: 0,
    endIndex: 26,
  });
  // Near the bottom it is shifted back so the target stays inside.
  assert.deepEqual(computeWindowAroundIndex({ ...base, index: 127 }), {
    startIndex: 101,
    endIndex: 127,
  });
  // A list smaller than one viewport renders fully.
  assert.deepEqual(
    computeWindowAroundIndex({
      index: 3,
      totalCount: 5,
      viewportHeight: 689,
      estimatedHeight: 64,
      overscan: 8,
    }),
    { startIndex: 0, endIndex: 4 },
  );
});

test("computeWindowAroundIndex handles degenerate input", () => {
  assert.deepEqual(
    computeWindowAroundIndex({
      index: 50,
      totalCount: 0,
      viewportHeight: 689,
      estimatedHeight: 64,
    }),
    { startIndex: 0, endIndex: 0 },
  );
  // Unknown viewport height still yields a usable overscan-sized window.
  assert.deepEqual(
    computeWindowAroundIndex({
      index: 50,
      totalCount: 128,
      viewportHeight: 0,
      estimatedHeight: 64,
      overscan: 8,
    }),
    { startIndex: 42, endIndex: 57 },
  );
  // A non-finite index falls back to the first row.
  assert.deepEqual(
    computeWindowAroundIndex({
      index: Number.NaN,
      totalCount: 128,
      viewportHeight: 689,
      estimatedHeight: 64,
      overscan: 8,
    }),
    { startIndex: 0, endIndex: 26 },
  );
});
