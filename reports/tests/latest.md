# Test Status Report

- Generated At: 2026-03-01T09:38:24.325Z
- Mode: all

## Summary

| total | pass | fail | skip |
| ---: | ---: | ---: | ---: |
| 25 | 23 | 1 | 1 |

## Diff

- New Failures: 0
- Resolved: 0
- New Skips: 0

## Governance

- Uncataloged: 0
- Outdated Candidates: 0
- Review Overdue: 0
- Catalog Orphans: 0
- Duplicate Catalog Entries: 0
- Diagnostic Policy Violations: 0

## Failing Tests

- tests/server/youtube/service.test.ts :: resolveTranscriptSegments falls back to vtt when other formats are empty

## Skipped Tests

- tests/diagnostics/youtube/diagnose-payload.test.ts :: diagnose caption payloads for specific video

## Cases

| status | file | test | validity | reviewBy |
| --- | --- | --- | --- | --- |
| fail | tests/server/youtube/service.test.ts | resolveTranscriptSegments falls back to vtt when other formats are empty | needs-review | 2026-03-31 |
| skip | tests/diagnostics/youtube/diagnose-payload.test.ts | diagnose caption payloads for specific video | needs-review | 2026-03-31 |
| pass | tests/server/rateLimit.test.ts | checkRateLimit limits requests over threshold | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | mergeSegments force-splits when duration exceeds 15 seconds | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | mergeSegments merges adjacent segments without sentence-ending punctuation | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | mergeSegments returns empty array for empty input | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | mergeSegments returns single segment unchanged | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | mergeSegments splits on sentence-ending punctuation | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload decodes nested html entities in json3 text | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload decodes nested html entities in xml text | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload does not treat html pages as transcript xml | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload parses json3 | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload parses json3 when timestamps are numeric strings | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload parses webvtt | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload parses xml | reasonable | 2026-03-31 |
| pass | tests/server/youtube/segments.test.ts | parseTranscriptPayload treats empty payload as unsupported | reasonable | 2026-03-31 |
| pass | tests/server/youtube/service.test.ts | fetchTranscriptMetadata returns tracks from innertube player | reasonable | 2026-03-31 |
| pass | tests/server/youtube/service.test.ts | resolveTranscriptSegments parses json3 payload | reasonable | 2026-03-31 |
| pass | tests/server/youtube/service.test.ts | resolveTranscriptSegments tries exact caption URL before derived variants | reasonable | 2026-03-31 |
| pass | tests/server/youtube/trackToken.test.ts | track token preserves caption URL query bytes | reasonable | 2026-03-31 |
| pass | tests/server/youtube/trackToken.test.ts | track token rejects tampered signatures | reasonable | 2026-03-31 |
| pass | tests/server/youtube/trackToken.test.ts | track token signs and validates payload | reasonable | 2026-03-31 |
| pass | tests/server/youtube/url.test.ts | parseStrictYouTubeVideoId parses short URL | reasonable | 2026-03-31 |
| pass | tests/server/youtube/url.test.ts | parseStrictYouTubeVideoId parses watch URL | reasonable | 2026-03-31 |
| pass | tests/server/youtube/url.test.ts | parseStrictYouTubeVideoId rejects non-youtube hosts | reasonable | 2026-03-31 |
