import assert from "node:assert/strict";
import test from "node:test";
import { clientIpFromRequest } from "@/server/http";

test("returns first hop of x-forwarded-for when multiple ips", () => {
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  });
  assert.equal(clientIpFromRequest(request), "1.2.3.4");
});

test("returns single x-forwarded-for ip", () => {
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "9.9.9.9" },
  });
  assert.equal(clientIpFromRequest(request), "9.9.9.9");
});

test("trims whitespace from x-forwarded-for", () => {
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "  1.2.3.4  " },
  });
  assert.equal(clientIpFromRequest(request), "1.2.3.4");
});

test("returns unknown when no forwarded header", () => {
  const request = new Request("https://example.com");
  assert.equal(clientIpFromRequest(request), "unknown");
});

test("returns unknown for empty x-forwarded-for", () => {
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "" },
  });
  assert.equal(clientIpFromRequest(request), "unknown");
});
