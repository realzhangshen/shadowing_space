import assert from "node:assert/strict";
import test from "node:test";
import {
  isSameOriginUrl,
  restrictRuntimeCachingToSameOrigin,
  sameOriginOnlyMatcher,
} from "@/lib/swRuntimeCaching";

const ORIGIN = "https://shadowing.space";

function optionsFor(href: string, extra: Record<string, unknown> = {}) {
  return { url: new URL(href), ...extra };
}

test("isSameOriginUrl treats the default port and trailing slash as the same origin", () => {
  assert.equal(isSameOriginUrl("https://shadowing.space/api/health", ORIGIN), true);
  assert.equal(isSameOriginUrl("https://shadowing.space:443/api/health", ORIGIN), true);
  assert.equal(
    isSameOriginUrl("http://localhost:3000/videos/a.webp", "http://localhost:3000"),
    true,
  );
  assert.equal(isSameOriginUrl("http://localhost:80/videos/a.webp", "http://localhost"), true);
  assert.equal(isSameOriginUrl("https://shadowing.space/", `${ORIGIN}/`), true);
});

test("isSameOriginUrl rejects different schemes, ports, subdomains, and hosts", () => {
  assert.equal(isSameOriginUrl("http://shadowing.space/api/health", ORIGIN), false);
  assert.equal(isSameOriginUrl("https://shadowing.space:8443/api/health", ORIGIN), false);
  assert.equal(isSameOriginUrl("https://www.shadowing.space/api/health", ORIGIN), false);
  assert.equal(isSameOriginUrl("https://other.example.com/api/health", ORIGIN), false);
  assert.equal(
    isSameOriginUrl("https://i.ytimg.com/vi/FRI78tq9Eik/maxresdefault.webp", ORIGIN),
    false,
  );
});

test("isSameOriginUrl resolves relative and protocol-relative URLs against the worker origin", () => {
  assert.equal(isSameOriginUrl("/videos/a.webp", ORIGIN), true);
  assert.equal(isSameOriginUrl("videos/a.webp", ORIGIN), true);
  assert.equal(isSameOriginUrl("//i.ytimg.com/vi/FRI78tq9Eik/hqdefault.jpg", ORIGIN), false);
  assert.equal(isSameOriginUrl("//shadowing.space/videos/a.webp", ORIGIN), true);
});

test("isSameOriginUrl returns false for malformed URLs", () => {
  assert.equal(isSameOriginUrl("http://[invalid", ORIGIN), false);
  assert.equal(isSameOriginUrl("https://shadowing.space/", "not a url"), false);
});

test("sameOriginOnlyMatcher blocks cross-origin image URLs before the regex runs", () => {
  const imageMatcher = /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i;
  const matcher = sameOriginOnlyMatcher(imageMatcher, ORIGIN);

  assert.equal(
    matcher(optionsFor("https://i.ytimg.com/vi_webp/FRI78tq9Eik/maxresdefault.webp")),
    false,
  );
  assert.equal(matcher(optionsFor("https://i9.ytimg.com/vi/FRI78tq9Eik/hqdefault.jpg")), false);
  assert.equal(matcher(optionsFor("https://shadowing.space/images/logo.webp")), true);
});

test("sameOriginOnlyMatcher delegates same-origin URLs to regex matchers", () => {
  const imageMatcher = /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i;
  const matcher = sameOriginOnlyMatcher(imageMatcher, ORIGIN);

  assert.equal(matcher(optionsFor("https://shadowing.space/images/logo.webp")), true);
  assert.equal(matcher(optionsFor("https://shadowing.space/api/history.json")), false);
});

test("sameOriginOnlyMatcher delegates same-origin URLs to string matchers", () => {
  const matcher = sameOriginOnlyMatcher("/images/logo.webp", ORIGIN);

  assert.equal(matcher(optionsFor("https://shadowing.space/images/logo.webp")), true);
  assert.equal(matcher(optionsFor("https://shadowing.space/images/other.webp")), false);
  assert.equal(matcher(optionsFor("https://i.ytimg.com/images/logo.webp")), false);
});

test("sameOriginOnlyMatcher delegates function matchers with the original options object", () => {
  const seen: unknown[] = [];
  const original = (options: { url: URL; sameOrigin: boolean }) => {
    seen.push(options);
    return options.sameOrigin && options.url.pathname.startsWith("/api/");
  };
  const matcher = sameOriginOnlyMatcher(original, ORIGIN);
  const options = optionsFor("https://shadowing.space/api/history", { sameOrigin: true });

  assert.equal(matcher(options), true);
  assert.deepEqual(seen, [options]);
});

test("sameOriginOnlyMatcher skips function matchers for cross-origin URLs", () => {
  const seen: unknown[] = [];
  const original = (options: { url: URL }) => {
    seen.push(options);
    return true;
  };
  const matcher = sameOriginOnlyMatcher(original, ORIGIN);

  assert.equal(matcher(optionsFor("https://www.youtube.com/embed/FRI78tq9Eik")), false);
  assert.deepEqual(seen, []);
});

test("restrictRuntimeCachingToSameOrigin preserves entry order and does not mutate the input", () => {
  const imageEntry = { matcher: /\.(?:jpg|webp)$/i, handler: "image" };
  const feedEntry = { matcher: "/feed.xml", handler: "feed" };
  const apiEntry = {
    matcher: (options: { url: URL }) => options.url.pathname.startsWith("/api/"),
    handler: "api",
  };
  const entries = [imageEntry, feedEntry, apiEntry];

  const restricted = restrictRuntimeCachingToSameOrigin(entries, ORIGIN);

  assert.equal(restricted.length, 3);
  assert.deepEqual(
    restricted.map((entry) => entry.handler),
    ["image", "feed", "api"],
  );
  assert.notEqual(restricted, entries);
  assert.notEqual(restricted[0], entries[0]);
  assert.notEqual(restricted[1], entries[1]);
  assert.notEqual(restricted[2], entries[2]);
  assert.notEqual(restricted[0].matcher, imageEntry.matcher);
  assert.notEqual(restricted[1].matcher, feedEntry.matcher);
  assert.notEqual(restricted[2].matcher, apiEntry.matcher);
  assert.equal(entries[0].matcher, imageEntry.matcher);
  assert.equal(entries[1].matcher, feedEntry.matcher);
  assert.equal(entries[2].matcher, apiEntry.matcher);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].handler, "image");
  assert.equal(typeof restricted[0].matcher, "function");
  assert.equal(typeof restricted[1].matcher, "function");
  assert.equal(typeof restricted[2].matcher, "function");
  assert.equal(
    restricted[0].matcher(optionsFor("https://i.ytimg.com/vi/FRI78tq9Eik/hqdefault.jpg")),
    false,
  );
  assert.equal(
    restricted[2].matcher(optionsFor("https://i.ytimg.com/vi/FRI78tq9Eik/maxresdefault.webp")),
    false,
  );
});

test("restrictRuntimeCachingToSameOrigin keeps handlers and other runtime-caching fields", () => {
  const handler = () => Promise.resolve(new Response("ok"));
  const entries = [{ matcher: /\.(?:css|js)$/i, handler, method: "GET" as const }];

  const [restricted] = restrictRuntimeCachingToSameOrigin(entries, ORIGIN);

  assert.equal(restricted.handler, handler);
  assert.equal(restricted.method, "GET");
});
