import assert from "node:assert/strict";
import test from "node:test";
import { __testOnly, checkRateLimit } from "@/server/rateLimit";

test("checkRateLimit limits requests over threshold", () => {
  __testOnly.clearBuckets();

  const first = checkRateLimit("ip:route", 2, 60_000);
  const second = checkRateLimit("ip:route", 2, 60_000);
  const third = checkRateLimit("ip:route", 2, 60_000);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
});
