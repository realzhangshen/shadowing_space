import assert from "node:assert/strict";
import test from "node:test";
import { parseTimestampToMs } from "../../extension/lib/player-response.js";

test("parseTimestampToMs handles M:SS format", () => {
  assert.equal(parseTimestampToMs("0:00"), 0);
  assert.equal(parseTimestampToMs("1:23"), 83_000);
  assert.equal(parseTimestampToMs("59:59"), 3_599_000);
});

test("parseTimestampToMs handles H:MM:SS format", () => {
  assert.equal(parseTimestampToMs("1:00:00"), 3_600_000);
  assert.equal(parseTimestampToMs("1:23:45"), 5_025_000);
  assert.equal(parseTimestampToMs("10:30:15"), 37_815_000);
});

test("parseTimestampToMs returns NaN for malformed input", () => {
  assert.ok(Number.isNaN(parseTimestampToMs("")));
  assert.ok(Number.isNaN(parseTimestampToMs("not-a-time")));
  assert.ok(Number.isNaN(parseTimestampToMs("1")));
  assert.ok(Number.isNaN(parseTimestampToMs("1:2:3:4")));
  assert.ok(Number.isNaN(parseTimestampToMs(null)));
});

test("parseTimestampToMs tolerates whitespace around the value", () => {
  assert.equal(parseTimestampToMs("  1:23  "), 83_000);
  assert.equal(parseTimestampToMs("\n0:05\n"), 5_000);
});
