import type { SegmentDTO } from "@/types/api";

const DEFAULT_DURATION_MS = 1_600;
const MIN_DURATION_MS = 200;

type TranscriptEvent = {
  tStartMs?: number | string;
  dDurationMs?: number | string;
  segs?: Array<{ utf8?: string; text?: string }>;
};

function parseNumberishMs(value: number | string | undefined): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.round(parsed);
  }

  return null;
}

function clampDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return DEFAULT_DURATION_MS;
  }
  return Math.max(MIN_DURATION_MS, Math.round(durationMs));
}

function normalizeText(raw: string): string {
  return raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function parseClockTimestampToMs(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const match = normalized.match(/^(\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?$/);
  if (!match) {
    return null;
  }

  const parts = normalized.split(":");
  const [hoursRaw, minutesRaw, secondsRaw] = parts.length === 3 ? parts : ["0", parts[0], parts[1]];
  const [secondsPart, millisecondsPart = "0"] = secondsRaw.split(".");

  const hours = Number.parseInt(hoursRaw, 10);
  const minutes = Number.parseInt(minutesRaw, 10);
  const seconds = Number.parseInt(secondsPart, 10);
  const milliseconds = Number.parseInt(millisecondsPart.padEnd(3, "0").slice(0, 3), 10);

  if ([hours, minutes, seconds, milliseconds].some((part) => Number.isNaN(part))) {
    return null;
  }

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds;
}

function parseUnitTimeToMs(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/i);
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const unit = match[2].toLowerCase();
  const multiplier = unit === "ms" ? 1 : unit === "s" ? 1_000 : unit === "m" ? 60_000 : 3_600_000;
  return Math.round(amount * multiplier);
}

function parseTimeValueToMs(value: string, numericUnit: "seconds" | "milliseconds"): number | null {
  const clock = parseClockTimestampToMs(value);
  if (clock !== null) {
    return clock;
  }

  const withUnit = parseUnitTimeToMs(value);
  if (withUnit !== null) {
    return withUnit;
  }

  const numeric = Number.parseFloat(value.trim());
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric * (numericUnit === "seconds" ? 1_000 : 1));
}

function decodeXmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };

  const toChar = (codePoint: number, fallback: string): string => {
    if (!Number.isFinite(codePoint) || codePoint < 0) {
      return fallback;
    }
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      // Invalid Unicode code point - return raw entity
      return fallback;
    }
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (raw, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return toChar(Number.parseInt(entity.slice(2), 16), raw);
    }

    if (entity.startsWith("#")) {
      return toChar(Number.parseInt(entity.slice(1), 10), raw);
    }

    return named[entity] ?? raw;
  });
}

// YouTube sometimes returns double-encoded HTML entities (e.g., &amp;#39; instead of &#39;).
// This function iteratively decodes entities until no more are found, with a safety limit.
const MAX_ENTITY_DECODE_PASSES = 4;

function decodeNestedXmlEntities(value: string): string {
  let decoded = value;

  for (let pass = 0; pass < MAX_ENTITY_DECODE_PASSES; pass += 1) {
    const next = decodeXmlEntities(decoded);
    if (next === decoded) {
      break;
    }
    decoded = next;
  }

  return decoded;
}

function parseXmlAttributes(rawAttributes: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][\w:.-]*)=(?:"([^"]*)"|'([^']*)')/g;

  let match = pattern.exec(rawAttributes);
  while (match) {
    const key = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? "";
    if (key) {
      parsed[key] = value;
    }
    match = pattern.exec(rawAttributes);
  }

  return parsed;
}

function normalizeJson3Segments(events: TranscriptEvent[]): SegmentDTO[] {
  const segments: SegmentDTO[] = [];

  for (const event of events) {
    if (!Array.isArray(event.segs)) {
      continue;
    }

    const startMs = parseNumberishMs(event.tStartMs);
    if (startMs === null) {
      continue;
    }

    const text = normalizeText(
      decodeNestedXmlEntities(event.segs.map((item) => item.utf8 ?? item.text ?? "").join("")),
    );
    if (!text) {
      continue;
    }

    const durationMs = parseNumberishMs(event.dDurationMs);
    const endMs = startMs + clampDuration(durationMs ?? DEFAULT_DURATION_MS);

    segments.push({
      index: segments.length,
      startMs,
      endMs,
      text,
    });
  }

  return segments;
}

function normalizeXmlSegments(xml: string): SegmentDTO[] {
  const segments: SegmentDTO[] = [];
  const textPattern = /<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  let match = textPattern.exec(xml);
  while (match) {
    const attributes = parseXmlAttributes(match[2] ?? "");
    const startFromStart = attributes.start
      ? parseTimeValueToMs(attributes.start, "seconds")
      : null;
    const startFromT = attributes.t ? parseTimeValueToMs(attributes.t, "milliseconds") : null;
    const startFromBegin = attributes.begin
      ? parseTimeValueToMs(attributes.begin, "seconds")
      : null;
    const startMs = startFromStart ?? startFromT ?? startFromBegin;

    if (startMs === null) {
      match = textPattern.exec(xml);
      continue;
    }

    const text = normalizeText(decodeNestedXmlEntities((match[3] ?? "").replace(/<[^>]+>/g, " ")));
    if (!text) {
      match = textPattern.exec(xml);
      continue;
    }

    const withDur = attributes.dur ? parseTimeValueToMs(attributes.dur, "seconds") : null;
    const withD = attributes.d ? parseTimeValueToMs(attributes.d, "milliseconds") : null;
    const withEnd = attributes.end ? parseTimeValueToMs(attributes.end, "seconds") : null;

    let durationMs = withDur ?? withD;
    if (durationMs === null && withEnd !== null && withEnd > startMs) {
      durationMs = withEnd - startMs;
    }

    segments.push({
      index: segments.length,
      startMs,
      endMs: startMs + clampDuration(durationMs ?? DEFAULT_DURATION_MS),
      text,
    });

    match = textPattern.exec(xml);
  }

  return segments;
}

function looksLikeVtt(payload: string): boolean {
  if (payload.startsWith("WEBVTT")) {
    return true;
  }

  return /\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s+-->\s+\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?/.test(
    payload,
  );
}

function normalizeVttSegments(vttText: string): SegmentDTO[] {
  const segments: SegmentDTO[] = [];
  const lines = vttText.replace(/\r/g, "").split("\n");

  let cursor = 0;
  while (cursor < lines.length) {
    let line = lines[cursor]?.trim() ?? "";

    if (!line) {
      cursor += 1;
      continue;
    }

    if (line.startsWith("WEBVTT")) {
      cursor += 1;
      continue;
    }

    if (line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) {
      cursor += 1;
      while (cursor < lines.length && lines[cursor]?.trim()) {
        cursor += 1;
      }
      continue;
    }

    if (!line.includes("-->")) {
      const nextLine = lines[cursor + 1]?.trim() ?? "";
      if (!nextLine.includes("-->")) {
        cursor += 1;
        continue;
      }

      cursor += 1;
      line = nextLine;
    }

    const [startRaw = "", endRaw = ""] = line.split("-->");
    const startMs = parseClockTimestampToMs(startRaw.trim().split(/\s+/)[0] ?? "");
    const endMs = parseClockTimestampToMs(endRaw.trim().split(/\s+/)[0] ?? "");

    cursor += 1;
    const cueLines: string[] = [];
    while (cursor < lines.length && lines[cursor]?.trim()) {
      cueLines.push(lines[cursor] ?? "");
      cursor += 1;
    }

    if (startMs === null || endMs === null || endMs <= startMs) {
      continue;
    }

    const text = normalizeText(
      decodeNestedXmlEntities(cueLines.join(" ").replace(/<[^>]+>/g, " ")),
    );
    if (!text) {
      continue;
    }

    segments.push({
      index: segments.length,
      startMs,
      endMs: startMs + clampDuration(endMs - startMs),
      text,
    });
  }

  return segments;
}

function stripXssiPrefix(payload: string): string {
  return payload.replace(/^\)\]\}'\s*/, "");
}

// Only real HTML document markers count as HTML. `<body>` alone is not a marker:
// YouTube srv3/timedtext payloads are `<timedtext><body><p t=...>` and are valid captions.
function looksLikeHtmlDocument(payload: string): boolean {
  const lowered = payload.slice(0, 800).toLowerCase();
  return (
    lowered.includes("<!doctype html") || lowered.includes("<html") || lowered.includes("<head")
  );
}

function looksLikeTranscriptXml(payload: string): boolean {
  if (
    payload.includes("<transcript") ||
    payload.includes("<timedtext") ||
    payload.includes("<tt")
  ) {
    return true;
  }

  return /<(text|p)\b[^>]*(start|t|begin|dur|d|end)\s*=/i.test(payload);
}

// Terminal punctuation of a sentence or fragment, optionally followed by closing quotes/brackets.
const SENTENCE_END = /[.?!。？！…]["'”’)\]]*\s*$/;
// A pause longer than this between cues is a phrase boundary (lyrics, poetry, slides).
const MAX_GAP_MS = 750;
// Hard cap on one practice sentence so a run of unpunctuated cues cannot collapse into a wall of text.
const MAX_MERGED_DURATION_MS = 8_000;
const MAX_MERGED_TEXT_LENGTH = 220;

function flush(buffer: SegmentDTO[], index: number): SegmentDTO {
  return {
    index,
    startMs: buffer[0].startMs,
    endMs: buffer[buffer.length - 1].endMs,
    text: buffer.map((s) => s.text).join(" "),
  };
}

function shouldSplitBuffer(buffer: SegmentDTO[], current: SegmentDTO): boolean {
  const previous = buffer[buffer.length - 1];

  if (SENTENCE_END.test(previous.text)) {
    return true;
  }

  if (current.startMs - previous.endMs > MAX_GAP_MS) {
    return true;
  }

  if (current.endMs - buffer[0].startMs > MAX_MERGED_DURATION_MS) {
    return true;
  }

  const bufferedTextLength = buffer.reduce((total, segment) => total + segment.text.length, 0);
  const mergedTextLength = bufferedTextLength + buffer.length + current.text.length;

  return mergedTextLength > MAX_MERGED_TEXT_LENGTH;
}

// Merges consecutive cues until a sentence boundary, a pause, or a size cap is reached.
// Text is never dropped: every input cue lands in exactly one output segment and timings
// keep their original [first.startMs, last.endMs] bounds.
export function mergeSegments(segments: SegmentDTO[]): SegmentDTO[] {
  if (segments.length === 0) return [];

  const merged: SegmentDTO[] = [];
  let buffer: SegmentDTO[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const current = segments[i];

    if (shouldSplitBuffer(buffer, current)) {
      merged.push(flush(buffer, merged.length));
      buffer = [current];
      continue;
    }

    buffer.push(current);
  }

  if (buffer.length > 0) {
    merged.push(flush(buffer, merged.length));
  }

  return merged;
}

export function parseTranscriptPayload(rawPayload: string): {
  parsed: boolean;
  segments: SegmentDTO[];
} {
  const trimmed = rawPayload.trim();
  if (!trimmed) {
    return { parsed: false, segments: [] };
  }

  const jsonCandidate = stripXssiPrefix(trimmed);
  if (jsonCandidate.startsWith("{") || jsonCandidate.startsWith("[")) {
    try {
      const parsed = JSON.parse(jsonCandidate) as { events?: TranscriptEvent[] };
      if (Array.isArray(parsed.events)) {
        return { parsed: true, segments: normalizeJson3Segments(parsed.events) };
      }
      return { parsed: false, segments: [] };
    } catch {
      // JSON parse failed - not valid JSON, continue to XML/VTT fallback parsers
    }
  }

  // XML caption formats first: srv3/timedtext and TTML both carry a <body>/<head> element,
  // so the HTML check must only reject payloads that do not look like captions.
  if (looksLikeTranscriptXml(trimmed)) {
    return { parsed: true, segments: normalizeXmlSegments(trimmed) };
  }

  if (looksLikeHtmlDocument(trimmed)) {
    return { parsed: false, segments: [] };
  }

  if (looksLikeVtt(trimmed)) {
    return { parsed: true, segments: normalizeVttSegments(trimmed) };
  }

  return { parsed: false, segments: [] };
}
