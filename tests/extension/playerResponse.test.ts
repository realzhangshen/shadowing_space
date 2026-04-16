import assert from "node:assert/strict";
import test from "node:test";
import {
  readPlayerResponse,
  hasUsableCaptionTracks,
  chooseCaptionTrack,
  type CaptionTrackLike,
  type PlayerResponseLike,
} from "../../extension/lib/player-response.js";

function makeTrack(overrides: Partial<CaptionTrackLike> = {}): CaptionTrackLike {
  return {
    baseUrl: "https://www.youtube.com/api/timedtext?v=abc",
    languageCode: "en",
    name: { simpleText: "English" },
    ...overrides,
  };
}

function makePlayerShape(tracks: CaptionTrackLike[]): PlayerResponseLike {
  return {
    captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } },
    videoDetails: { videoId: "abc", title: "Test" },
  };
}

test("readPlayerResponse returns ytInitialPlayerResponse when present", () => {
  const payload = makePlayerShape([makeTrack()]);
  const result = readPlayerResponse({ ytInitialPlayerResponse: payload });
  assert.equal(result, payload);
});

test("readPlayerResponse falls back to ytplayer.config.args.player_response JSON string", () => {
  const payload = makePlayerShape([makeTrack()]);
  const result = readPlayerResponse({
    ytplayer: {
      config: {
        args: {
          player_response: JSON.stringify(payload),
        },
      },
    },
  });

  assert.ok(result);
  assert.equal(result.videoDetails?.videoId, "abc");
});

test("readPlayerResponse falls back to ytplayer.config.args.raw_player_response object", () => {
  const payload = makePlayerShape([makeTrack()]);
  const result = readPlayerResponse({
    ytplayer: {
      config: {
        args: {
          raw_player_response: payload,
        },
      },
    },
  });

  assert.ok(result);
  assert.equal(result.videoDetails?.videoId, "abc");
});

test("readPlayerResponse returns null when no known shape is present", () => {
  assert.equal(readPlayerResponse({}), null);
  assert.equal(readPlayerResponse({ ytplayer: {} }), null);
  assert.equal(readPlayerResponse({ ytInitialPlayerResponse: "not an object" }), null);
});

test("readPlayerResponse tolerates malformed JSON in player_response field", () => {
  const result = readPlayerResponse({
    ytplayer: { config: { args: { player_response: "{not json" } } },
  });
  assert.equal(result, null);
});

test("hasUsableCaptionTracks detects at least one caption track", () => {
  assert.equal(hasUsableCaptionTracks(makePlayerShape([makeTrack()])), true);
  assert.equal(hasUsableCaptionTracks(makePlayerShape([])), false);
  assert.equal(hasUsableCaptionTracks({ captions: {} }), false);
  assert.equal(hasUsableCaptionTracks(null), false);
});

test("chooseCaptionTrack prefers manual English over auto English", () => {
  const manual = makeTrack({ languageCode: "en", kind: undefined });
  const auto = makeTrack({ languageCode: "en", kind: "asr" });
  const track = chooseCaptionTrack([auto, manual]);
  assert.equal(track, manual);
});

test("chooseCaptionTrack honors a preferred language when available", () => {
  const en = makeTrack({ languageCode: "en" });
  const ja = makeTrack({ languageCode: "ja" });
  const track = chooseCaptionTrack([en, ja], { preferredLanguage: "ja" });
  assert.equal(track, ja);
});

test("chooseCaptionTrack falls back to the first track when preferences are unmet", () => {
  const fr = makeTrack({ languageCode: "fr" });
  const de = makeTrack({ languageCode: "de" });
  const track = chooseCaptionTrack([fr, de], { preferredLanguage: "zh" });
  assert.equal(track, fr);
});

test("chooseCaptionTrack returns null for empty input", () => {
  assert.equal(chooseCaptionTrack([]), null);
  assert.equal(chooseCaptionTrack(null), null);
});
