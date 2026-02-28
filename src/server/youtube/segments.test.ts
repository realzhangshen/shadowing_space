import assert from "node:assert/strict";
import test from "node:test";
import { mergeSegments, parseTranscriptPayload } from "@/server/youtube/segments";

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

// mergeSegments tests

test("mergeSegments returns empty array for empty input", () => {
  assert.deepEqual(mergeSegments([]), []);
});

test("mergeSegments returns single segment unchanged", () => {
  const input = [{ index: 0, startMs: 0, endMs: 2000, text: "Hello world" }];
  const result = mergeSegments(input);
  assert.deepEqual(result, [{ index: 0, startMs: 0, endMs: 2000, text: "Hello world" }]);
});

test("mergeSegments merges adjacent segments without sentence-ending punctuation", () => {
  const input = [
    { index: 0, startMs: 0, endMs: 2000, text: "Hello" },
    { index: 1, startMs: 2000, endMs: 4000, text: "world" },
    { index: 2, startMs: 4000, endMs: 6000, text: "today" }
  ];
  const result = mergeSegments(input);
  assert.deepEqual(result, [
    { index: 0, startMs: 0, endMs: 6000, text: "Hello world today" }
  ]);
});

test("mergeSegments splits on sentence-ending punctuation", () => {
  const input = [
    { index: 0, startMs: 0, endMs: 2000, text: "Hello world." },
    { index: 1, startMs: 2000, endMs: 4000, text: "How are you?" },
    { index: 2, startMs: 4000, endMs: 6000, text: "I am fine" }
  ];
  const result = mergeSegments(input);
  assert.deepEqual(result, [
    { index: 0, startMs: 0, endMs: 2000, text: "Hello world." },
    { index: 1, startMs: 2000, endMs: 4000, text: "How are you?" },
    { index: 2, startMs: 4000, endMs: 6000, text: "I am fine" }
  ]);
});

test("mergeSegments force-splits when duration exceeds 15 seconds", () => {
  const input = [
    { index: 0, startMs: 0, endMs: 5000, text: "one" },
    { index: 1, startMs: 5000, endMs: 10000, text: "two" },
    { index: 2, startMs: 10000, endMs: 16000, text: "three" }
  ];
  const result = mergeSegments(input);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { index: 0, startMs: 0, endMs: 10000, text: "one two" });
  assert.deepEqual(result[1], { index: 1, startMs: 10000, endMs: 16000, text: "three" });
});

