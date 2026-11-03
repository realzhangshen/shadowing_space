import assert from "node:assert/strict";
import test from "node:test";
import { mergeSegments, parseTranscriptPayload } from "@/server/youtube/segments";

test("parseTranscriptPayload parses json3", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: 1000,
        dDurationMs: 2000,
        segs: [{ utf8: "Hello " }, { utf8: "world" }],
      },
    ],
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    {
      index: 0,
      startMs: 1000,
      endMs: 3000,
      text: "Hello world",
    },
  ]);
});

test("parseTranscriptPayload parses json3 when timestamps are numeric strings", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: "1000",
        dDurationMs: "2000",
        segs: [{ utf8: "Hello " }, { utf8: "world" }],
      },
    ],
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    {
      index: 0,
      startMs: 1000,
      endMs: 3000,
      text: "Hello world",
    },
  ]);
});

test("parseTranscriptPayload decodes nested html entities in json3 text", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: 1000,
        dDurationMs: 2000,
        segs: [{ utf8: "Don&amp;#39;t &amp;amp; go" }],
      },
    ],
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    {
      index: 0,
      startMs: 1000,
      endMs: 3000,
      text: "Don't & go",
    },
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
    text: "Hello & team",
  });
});

test("parseTranscriptPayload decodes nested html entities in xml text", () => {
  const payload = `<transcript><text start="1.2" dur="2">Don&amp;#39;t stop</text></transcript>`;
  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments[0], {
    index: 0,
    startMs: 1200,
    endMs: 3200,
    text: "Don't stop",
  });
});

test("parseTranscriptPayload decodes triple-nested html entities", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: 1000,
        dDurationMs: 2000,
        segs: [{ utf8: "&amp;amp;#39;" }],
      },
    ],
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    {
      index: 0,
      startMs: 1000,
      endMs: 3000,
      text: "'",
    },
  ]);
});

test("parseTranscriptPayload decodes nested html entities in vtt text", () => {
  const payload = `WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nDon&amp;#39;t stop\n`;
  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.equal(result.segments[0]?.text, "Don't stop");
});

test("parseTranscriptPayload handles malformed entities gracefully", () => {
  const payload = JSON.stringify({
    events: [
      {
        tStartMs: 1000,
        dDurationMs: 2000,
        segs: [{ utf8: "Hello &amp; world &invalid; goodbye" }],
      },
    ],
  });

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  // &amp; decodes to &, &invalid; is left as-is (fallback)
  assert.equal(result.segments[0]?.text, "Hello & world &invalid; goodbye");
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

test("parseTranscriptPayload rejects html error pages that use html and body without a doctype", () => {
  const payload = `<html><body><p>This video is unavailable.</p></body></html>`;
  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, false);
  assert.equal(result.segments.length, 0);
});

test("parseTranscriptPayload parses srv3 timedtext xml that contains a body element", () => {
  // Real shape of a YouTube srv3 payload: <timedtext><body><p t="ms" d="ms">text</p>
  // The <body> element must not make this look like an HTML error page.
  const payload = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<body>
<p t="1360" d="1680">[♪♪♪]</p>
<p t="18640" d="3240">♪ We&#39;re no strangers to love ♪</p>
<p t="27040" d="4000">♪ A full commitment&#39;s
what I&#39;m thinking of ♪</p>
<p t="43000" d="2120">Tom &amp; Jerry</p>
</body>
</timedtext>`;

  const result = parseTranscriptPayload(payload);

  assert.equal(result.parsed, true);
  assert.deepEqual(result.segments, [
    { index: 0, startMs: 1360, endMs: 3040, text: "[♪♪♪]" },
    { index: 1, startMs: 18640, endMs: 21880, text: "♪ We're no strangers to love ♪" },
    {
      index: 2,
      startMs: 27040,
      endMs: 31040,
      text: "♪ A full commitment's what I'm thinking of ♪",
    },
    { index: 3, startMs: 43000, endMs: 45120, text: "Tom & Jerry" },
  ]);
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
    { index: 2, startMs: 4000, endMs: 6000, text: "today" },
  ];
  const result = mergeSegments(input);
  assert.deepEqual(result, [{ index: 0, startMs: 0, endMs: 6000, text: "Hello world today" }]);
});

test("mergeSegments splits on sentence-ending punctuation", () => {
  const input = [
    { index: 0, startMs: 0, endMs: 2000, text: "Hello world." },
    { index: 1, startMs: 2000, endMs: 4000, text: "How are you?" },
    { index: 2, startMs: 4000, endMs: 6000, text: "I am fine" },
  ];
  const result = mergeSegments(input);
  assert.deepEqual(result, [
    { index: 0, startMs: 0, endMs: 2000, text: "Hello world." },
    { index: 1, startMs: 2000, endMs: 4000, text: "How are you?" },
    { index: 2, startMs: 4000, endMs: 6000, text: "I am fine" },
  ]);
});

test("mergeSegments merges continuous speech cues without sentence-ending punctuation", () => {
  // Auto-generated speech cues arrive back-to-back with tiny gaps and no punctuation.
  const input = [
    { index: 0, startMs: 0, endMs: 2000, text: "so the first thing" },
    { index: 1, startMs: 2080, endMs: 4000, text: "we should look at" },
    { index: 2, startMs: 4080, endMs: 6000, text: "is the request body" },
  ];
  const result = mergeSegments(input);
  assert.deepEqual(result, [
    {
      index: 0,
      startMs: 0,
      endMs: 6000,
      text: "so the first thing we should look at is the request body",
    },
  ]);
});

test("mergeSegments splits when the pause between cues exceeds the gap threshold", () => {
  // 1000ms pause between lyric lines is a phrase boundary; 0ms gaps stay merged.
  const input = [
    { index: 0, startMs: 0, endMs: 1000, text: "♪ first line" },
    { index: 1, startMs: 1000, endMs: 2000, text: "♪ second line" },
    { index: 2, startMs: 3000, endMs: 4000, text: "♪ third line" },
  ];
  const result = mergeSegments(input);
  assert.deepEqual(result, [
    { index: 0, startMs: 0, endMs: 2000, text: "♪ first line ♪ second line" },
    { index: 1, startMs: 3000, endMs: 4000, text: "♪ third line" },
  ]);
});

test("mergeSegments splits when merged duration would exceed 8 seconds", () => {
  const input = [
    { index: 0, startMs: 0, endMs: 4000, text: "one" },
    { index: 1, startMs: 4000, endMs: 8000, text: "two" },
    { index: 2, startMs: 8000, endMs: 12000, text: "three" },
  ];
  const result = mergeSegments(input);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { index: 0, startMs: 0, endMs: 8000, text: "one two" });
  assert.deepEqual(result[1], { index: 1, startMs: 8000, endMs: 12000, text: "three" });
});

test("mergeSegments splits when merged text would exceed the length cap", () => {
  const input = [
    { index: 0, startMs: 0, endMs: 1000, text: "a".repeat(100) },
    { index: 1, startMs: 1000, endMs: 2000, text: "b".repeat(100) },
    { index: 2, startMs: 2000, endMs: 3000, text: "c".repeat(100) },
  ];
  const result = mergeSegments(input);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    index: 0,
    startMs: 0,
    endMs: 2000,
    text: `${"a".repeat(100)} ${"b".repeat(100)}`,
  });
  assert.deepEqual(result[1], { index: 1, startMs: 2000, endMs: 3000, text: "c".repeat(100) });
});

test("mergeSegments preserves every cue text exactly once", () => {
  // Mixed payload: continuous lines, a terminal-punctuation line, a long pause and a >8s span.
  const input = [
    { index: 0, startMs: 0, endMs: 4000, text: "First line of the talk" },
    { index: 1, startMs: 4000, endMs: 8000, text: "second line continues" },
    { index: 2, startMs: 8000, endMs: 12000, text: "third line arrives" },
    { index: 3, startMs: 12000, endMs: 16000, text: "fourth line ends here." },
    { index: 4, startMs: 17500, endMs: 20000, text: "fifth line." },
  ];

  const result = mergeSegments(input);

  assert.deepEqual(result, [
    {
      index: 0,
      startMs: 0,
      endMs: 8000,
      text: "First line of the talk second line continues",
    },
    {
      index: 1,
      startMs: 8000,
      endMs: 16000,
      text: "third line arrives fourth line ends here.",
    },
    { index: 2, startMs: 17500, endMs: 20000, text: "fifth line." },
  ]);
  // No text lost or duplicated.
  assert.equal(
    result.map((segment) => segment.text).join(" "),
    input.map((segment) => segment.text).join(" "),
  );
  // Indexes stay sequential and timings stay inside the original span.
  result.forEach((segment, position) => {
    assert.equal(segment.index, position);
    assert.ok(segment.endMs > segment.startMs);
  });
});
