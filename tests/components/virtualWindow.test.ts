import assert from "node:assert/strict";
import test from "node:test";
import {
  computeVisibleWindow,
  isIndexInWindow,
  scrollOffsetForIndex,
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
