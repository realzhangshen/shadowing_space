import assert from "node:assert/strict";
import test from "node:test";
import { buildThumbnailCandidates, normalizeThumbnailUrl } from "@/lib/thumbnail";

const VIDEO_ID = "FRI78tq9Eik";

test("buildThumbnailCandidates keeps the original YouTube URL first and appends size fallbacks", () => {
  const candidates = buildThumbnailCandidates(
    `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
  );

  assert.deepEqual(candidates, [
    `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/default.jpg`,
  ]);
});

test("buildThumbnailCandidates adds a jpg equivalent for webp thumbnail URLs", () => {
  const candidates = buildThumbnailCandidates(
    `https://i9.ytimg.com/vi_webp/${VIDEO_ID}/maxresdefault.webp`,
  );

  assert.deepEqual(candidates, [
    `https://i9.ytimg.com/vi_webp/${VIDEO_ID}/maxresdefault.webp`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/default.jpg`,
  ]);
});

test("buildThumbnailCandidates upgrades protocol-relative and http YouTube URLs to https", () => {
  assert.deepEqual(
    buildThumbnailCandidates(`//i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`).slice(0, 2),
    [
      `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${VIDEO_ID}/sddefault.jpg`,
    ],
  );

  assert.equal(
    buildThumbnailCandidates(`http://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`)[0],
    `https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`,
  );
});

test("buildThumbnailCandidates de-duplicates repeated candidates and is idempotent", () => {
  const candidates = buildThumbnailCandidates(`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`);

  assert.deepEqual(candidates, [
    `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${VIDEO_ID}/default.jpg`,
  ]);
  assert.equal(new Set(candidates).size, candidates.length);

  const webpUrl = `https://i.ytimg.com/vi_webp/${VIDEO_ID}/maxresdefault.webp`;
  assert.deepEqual(
    buildThumbnailCandidates(buildThumbnailCandidates(webpUrl)[0]!),
    buildThumbnailCandidates(webpUrl),
  );
});

test("buildThumbnailCandidates returns a single https candidate for non-YouTube URLs", () => {
  assert.deepEqual(buildThumbnailCandidates("http://example.com/cover.png"), [
    "https://example.com/cover.png",
  ]);
  assert.deepEqual(buildThumbnailCandidates("https://example.com/cover.png"), [
    "https://example.com/cover.png",
  ]);
});

test("buildThumbnailCandidates returns an empty list for missing or blank input", () => {
  assert.deepEqual(buildThumbnailCandidates(undefined), []);
  assert.deepEqual(buildThumbnailCandidates(""), []);
  assert.deepEqual(buildThumbnailCandidates("   "), []);
});

test("buildThumbnailCandidates leaves YouTube URLs without a video path untouched", () => {
  assert.deepEqual(buildThumbnailCandidates("https://i.ytimg.com/vi/abc/hqdefault.jpg"), [
    "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  ]);
  assert.deepEqual(buildThumbnailCandidates("https://www.youtube.com/watch?v=abc"), [
    "https://www.youtube.com/watch?v=abc",
  ]);
});

test("normalizeThumbnailUrl trims input and forces https", () => {
  assert.equal(
    normalizeThumbnailUrl(`  https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg  `),
    `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
  );
  assert.equal(
    normalizeThumbnailUrl(`//i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`),
    `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
  );
  assert.equal(
    normalizeThumbnailUrl(`http://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`),
    `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
  );
});

test("normalizeThumbnailUrl returns undefined for blank or unparseable values", () => {
  assert.equal(normalizeThumbnailUrl(undefined), undefined);
  assert.equal(normalizeThumbnailUrl(""), undefined);
  assert.equal(normalizeThumbnailUrl("   "), undefined);
  assert.equal(normalizeThumbnailUrl("not a url"), undefined);
  assert.equal(normalizeThumbnailUrl("javascript:alert(1)"), undefined);
});
