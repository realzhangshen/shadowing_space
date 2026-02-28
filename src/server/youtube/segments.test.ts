import assert from "node:assert/strict";
import test from "node:test";
import { parseTranscriptPayload } from "@/server/youtube/segments";

test("parseTranscriptPayload parses json3", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: 1000,
        dDurationMs: 2000,
        segs: [{ utf8: "Hello " }, { utf8: "world" }]
      }
    ]
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    {
      index: 0,
      startMs: 1000,
      endMs: 3000,
      text: "Hello world"
    }
  ]);
});

test("parseTranscriptPayload parses json3 when timestamps are numeric strings", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: "1000",
        dDurationMs: "2000",
        segs: [{ utf8: "Hello " }, { utf8: "world" }]
      }
    ]
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    {
      index: 0,
      startMs: 1000,
      endMs: 3000,
      text: "Hello world"
    }
  ]);
});

test("parseTranscriptPayload parses xml", () => {
  const payload = `<transcript><text start="1.2" dur="2">Hello &amp; <b>team</b></text></transcript>`;
  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments[0], {
    index: 0,
    startMs: 1200,
    endMs: 3200,
    text: "Hello & team"
  });
});

test("parseTranscriptPayload parses webvtt", () => {
  const payload = `WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello\n`;
  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0]?.text, "Hello");
});

test("parseTranscriptPayload does not treat html pages as transcript xml", () => {
  const payload = `<!DOCTYPE html><html><body><p>Sorry, try again later.</p></body></html>`;
  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, false);
  assert.equal(result.segments.length, 0);
});

test("parseTranscriptPayload treats empty payload as unsupported", () => {
  const result = parseTranscriptPayload("   ");

  assert.equal(result.parsed, false);
  assert.equal(result.segments.length, 0);
});
