import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeTranscriptSegments,
  extractTranscriptTimestamp,
  fillTranscriptEndMs,
  mergeTranscriptRows,
  normalizeTranscriptText,
  parseTranscriptTimestamp,
  readTranscriptTextFromRow,
  resolveTranscriptRowTiming,
  shouldScrollTranscript,
} from "../../extension/lib/player-response.js";

// The transcript panel ships in two shapes over time:
//   legacy: <ytd-transcript-segment-renderer> with .segment-timestamp / .segment-text
//   modern: <transcript-segment-view-model> with .ytwTranscriptSegmentViewModelTimestamp
//           / .ytAttributedStringHost
// These tests pin the extraction helpers that the MAIN-world DOM reader uses, without
// requiring a real browser DOM: the mocks below implement only querySelector/childNodes.

type FakeNode = FakeText | FakeElement;

interface FakeText {
  nodeType: 3;
  nodeValue: string;
}

interface FakeElement {
  nodeType: 1;
  tagName: string;
  classes: string[];
  className: string;
  attributes: Record<string, string>;
  childNodes: FakeNode[];
  textContent: string;
  getAttribute(name: string): string | null;
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
}

function textNode(nodeValue: string): FakeText {
  return { nodeType: 3, nodeValue };
}

function matchesSimpleSelector(element: FakeElement, selector: string): boolean {
  const classAttributeMatch = selector.match(/^\[class\*="(.+)"\]$/);
  if (classAttributeMatch) {
    return element.className.includes(classAttributeMatch[1]);
  }

  const [tagPart, ...classParts] = selector.split(".");
  if (tagPart && tagPart !== "*" && element.tagName.toLowerCase() !== tagPart.toLowerCase()) {
    return false;
  }
  return classParts.every((className) => element.classes.includes(className));
}

function queryAllFrom(nodes: FakeNode[], selector: string): FakeElement[] {
  const found: FakeElement[] = [];
  const visit = (node: FakeNode) => {
    if (node.nodeType !== 1) return;
    if (matchesSimpleSelector(node, selector)) found.push(node);
    for (const child of node.childNodes) visit(child);
  };
  for (const node of nodes) visit(node);
  return found;
}

function fakeElement({
  tagName = "div",
  classes = [],
  attributes = {},
  text = "",
  children = [],
}: {
  tagName?: string;
  classes?: string[];
  attributes?: Record<string, string>;
  text?: string;
  children?: FakeNode[];
} = {}): FakeElement {
  const childNodes: FakeNode[] = [...(text ? [textNode(text)] : []), ...children];

  const element: FakeElement = {
    nodeType: 1,
    tagName,
    classes,
    className: classes.join(" "),
    attributes,
    childNodes,
    get textContent() {
      return childNodes
        .map((node) => (node.nodeType === 3 ? node.nodeValue : node.textContent))
        .join("");
    },
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    querySelector(selector: string) {
      return queryAllFrom(childNodes, selector)[0] ?? null;
    },
    querySelectorAll(selector: string) {
      return queryAllFrom(childNodes, selector);
    },
  };

  return element;
}

function modernRow({ timestamp, text }: { timestamp: string; text: string }): FakeElement {
  return fakeElement({
    tagName: "transcript-segment-view-model",
    classes: ["ytwTranscriptSegmentViewModelHost"],
    children: [
      fakeElement({ classes: ["ytwTranscriptSegmentViewModelTimestamp"], text: timestamp }),
      fakeElement({ classes: ["ytAttributedStringHost"], text }),
    ],
  });
}

test("readTranscriptTextFromRow reads modern transcript-segment-view-model text", () => {
  const row = modernRow({ timestamp: "0:12", text: "Hello   there,\nworld." });
  assert.equal(readTranscriptTextFromRow(row), "Hello there, world.");
});

test("readTranscriptTextFromRow ignores visually hidden a11y spoken-time labels", () => {
  const row = fakeElement({
    tagName: "transcript-segment-view-model",
    children: [
      fakeElement({
        classes: ["ytAttributedStringHost"],
        children: [
          textNode("Visible words"),
          fakeElement({ classes: ["visually-hidden"], text: "1 minute, 23 seconds" }),
        ],
      }),
    ],
  });

  assert.equal(readTranscriptTextFromRow(row), "Visible words");
});

test("readTranscriptTextFromRow still reads text hosted on an aria-hidden element", () => {
  const row = fakeElement({
    tagName: "transcript-segment-view-model",
    children: [
      fakeElement({
        classes: ["ytAttributedStringHost"],
        attributes: { "aria-hidden": "true" },
        text: "Visible words",
      }),
    ],
  });

  assert.equal(readTranscriptTextFromRow(row), "Visible words");
});

test("readTranscriptTextFromRow drops aria-hidden descendants inside the text host", () => {
  const row = fakeElement({
    tagName: "transcript-segment-view-model",
    children: [
      fakeElement({
        classes: ["ytAttributedStringHost"],
        children: [
          textNode("Visible words"),
          fakeElement({
            classes: ["yt-core-attributed-string--hidden"],
            attributes: { "aria-hidden": "true" },
            text: "1 minute, 23 seconds",
          }),
        ],
      }),
    ],
  });

  assert.equal(readTranscriptTextFromRow(row), "Visible words");
});

test("readTranscriptTextFromRow falls back to legacy segment-text", () => {
  const row = fakeElement({
    tagName: "ytd-transcript-segment-renderer",
    children: [
      fakeElement({ classes: ["segment-timestamp"], text: "0:42" }),
      fakeElement({
        classes: ["segment-text"],
        children: [fakeElement({ tagName: "yt-formatted-string", text: "Legacy words" })],
      }),
    ],
  });

  assert.equal(readTranscriptTextFromRow(row), "Legacy words");
});

test("resolveTranscriptRowTiming parses the modern timestamp element", () => {
  const row = modernRow({ timestamp: "1:23", text: "Hello" });

  assert.deepEqual(resolveTranscriptRowTiming(row), {
    startMs: 83_000,
    endMs: null,
    precision: "text",
  });
});

test("resolveTranscriptRowTiming ignores a11y spoken-time labels in the timestamp element", () => {
  const row = fakeElement({
    tagName: "transcript-segment-view-model",
    children: [
      fakeElement({
        classes: ["ytwTranscriptSegmentViewModelTimestamp"],
        children: [
          fakeElement({ classes: ["yt-core-attributed-string--visually-hidden"] }),
          textNode("1 minute, 23 seconds"),
          textNode("1:23"),
        ],
      }),
      fakeElement({ classes: ["ytAttributedStringHost"], text: "Hello" }),
    ],
  });

  assert.equal(resolveTranscriptRowTiming(row)?.startMs, 83_000);
});

test("resolveTranscriptRowTiming prefers Polymer millisecond data over displayed text", () => {
  const row = Object.assign(modernRow({ timestamp: "1:23", text: "Hello" }), {
    data: { startMs: "82723", endMs: "85500" },
  });

  assert.deepEqual(resolveTranscriptRowTiming(row), {
    startMs: 82_723,
    endMs: 85_500,
    precision: "polymer-ms",
  });
});

test("resolveTranscriptRowTiming falls back to a data-start-ms attribute", () => {
  const row = fakeElement({
    tagName: "transcript-segment-view-model",
    attributes: { "data-start-ms": "91234" },
    children: [
      fakeElement({ classes: ["ytwTranscriptSegmentViewModelTimestamp"], text: "1:23" }),
      fakeElement({ classes: ["ytAttributedStringHost"], text: "Hello" }),
    ],
  });

  assert.deepEqual(resolveTranscriptRowTiming(row), {
    startMs: 91_234,
    endMs: null,
    precision: "data-attr",
  });
});

test("resolveTranscriptRowTiming returns null when a row has no timing signal", () => {
  const row = fakeElement({
    tagName: "transcript-segment-view-model",
    children: [fakeElement({ classes: ["ytAttributedStringHost"], text: "Hello" })],
  });

  assert.equal(resolveTranscriptRowTiming(row), null);
});

test("mergeTranscriptRows dedupes rows repeated across scroll batches", () => {
  const firstBatch = [
    { startMs: 0, text: "Hello" },
    { startMs: 2_000, text: "world" },
  ];
  const secondBatch = [
    { startMs: 2_000, text: "world", endMs: 3_500 },
    { startMs: 4_000, text: "again" },
  ];

  assert.deepEqual(mergeTranscriptRows([firstBatch, secondBatch]), [
    { startMs: 0, endMs: 2_000, text: "Hello" },
    { startMs: 2_000, endMs: 3_500, text: "world" },
    { startMs: 4_000, endMs: 7_000, text: "again" },
  ]);
});

test("mergeTranscriptRows keeps rows collected before scrolling", () => {
  const existing = [{ startMs: 1_000, text: "second" }];
  const merged = mergeTranscriptRows([[{ startMs: 2_000, text: "third" }]], existing);

  assert.deepEqual(
    merged.map((segment) => segment.text),
    ["second", "third"],
  );
});

test("dedupeTranscriptSegments normalizes whitespace and sorts by startMs", () => {
  const segments = dedupeTranscriptSegments([
    { startMs: 5_000, text: "  third\nline " },
    { startMs: 0, text: "first" },
    { startMs: 0, text: "first" },
    { startMs: 5_000, text: "third line" },
  ]);

  assert.deepEqual(segments, [
    { startMs: 0, endMs: null, text: "first" },
    { startMs: 5_000, endMs: null, text: "third line" },
  ]);
});

test("dedupeTranscriptSegments keeps the longer known endMs for duplicate rows", () => {
  const segments = dedupeTranscriptSegments([
    { startMs: 0, endMs: null, text: "hello" },
    { startMs: 0, endMs: 4_200, text: "hello" },
    { startMs: 0, endMs: 1_000, text: "hello" },
  ]);

  assert.equal(segments.length, 1);
  assert.equal(segments[0].endMs, 4_200);
});

test("fillTranscriptEndMs fills each end from the next start and pads the last segment", () => {
  const segments = fillTranscriptEndMs([
    { startMs: 0, text: "a" },
    { startMs: 2_000, text: "b" },
    { startMs: 5_000, text: "c" },
  ]);

  assert.deepEqual(
    segments.map((segment) => segment.endMs),
    [2_000, 5_000, 8_000],
  );
});

test("fillTranscriptEndMs keeps explicit end times and recomputes invalid ones", () => {
  const segments = fillTranscriptEndMs([
    { startMs: 0, endMs: 1_500, text: "a" },
    { startMs: 2_000, endMs: 1_000, text: "b" },
    { startMs: 4_000, text: "c" },
  ]);

  assert.deepEqual(
    segments.map((segment) => segment.endMs),
    [1_500, 4_000, 7_000],
  );
});

test("parseTranscriptTimestamp parses M:SS and H:MM:SS timestamps", () => {
  assert.equal(parseTranscriptTimestamp("1:23"), 83_000);
  assert.equal(parseTranscriptTimestamp("1:23:45"), 5_025_000);
  assert.equal(parseTranscriptTimestamp(" 0:05 "), 5_000);
});

test("parseTranscriptTimestamp rejects spoken-time labels and malformed values", () => {
  assert.equal(parseTranscriptTimestamp("1 minute, 23 seconds"), null);
  assert.equal(parseTranscriptTimestamp(""), null);
  assert.equal(parseTranscriptTimestamp(null), null);
});

test("extractTranscriptTimestamp finds a visual timestamp inside mixed a11y text", () => {
  assert.equal(extractTranscriptTimestamp("1 minute, 23 seconds1:23"), 83_000);
  assert.equal(extractTranscriptTimestamp("0 minutes, 12 seconds0:12"), 12_000);
  assert.equal(extractTranscriptTimestamp("no timestamp here"), null);
});

test("normalizeTranscriptText collapses whitespace and non-breaking spaces", () => {
  assert.equal(normalizeTranscriptText("  a\u00a0 b\nc  "), "a b c");
  assert.equal(normalizeTranscriptText(null), "");
});

test("shouldScrollTranscript requires real overflow beyond a noise threshold", () => {
  assert.equal(shouldScrollTranscript({ scrollHeight: 1_000, clientHeight: 400 }), true);
  assert.equal(shouldScrollTranscript({ scrollHeight: 400, clientHeight: 400 }), false);
  assert.equal(shouldScrollTranscript({ scrollHeight: 405, clientHeight: 400 }), false);
  assert.equal(shouldScrollTranscript({ scrollHeight: 0, clientHeight: 0 }), false);
  assert.equal(shouldScrollTranscript(null), false);
});
