import assert from "node:assert/strict";
import test from "node:test";
import { parseStrictYouTubeVideoId } from "@/server/youtube/url";

test("parseStrictYouTubeVideoId parses watch URL", () => {
  assert.equal(
    parseStrictYouTubeVideoId("https://www.youtube.com/watch?v=FRI78tq9Eik"),
    "FRI78tq9Eik",
  );
});

test("parseStrictYouTubeVideoId parses short URL", () => {
  assert.equal(parseStrictYouTubeVideoId("https://youtu.be/FRI78tq9Eik"), "FRI78tq9Eik");
});

test("parseStrictYouTubeVideoId rejects non-youtube hosts", () => {
  assert.equal(parseStrictYouTubeVideoId("https://evil-youtube.com/watch?v=FRI78tq9Eik"), null);
});
