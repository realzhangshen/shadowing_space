/**
 * Diagnostic test for inspecting raw YouTube caption payloads.
 *
 * Skipped by default — run manually to debug payload parsing issues:
 *   DIAGNOSE=1 npx tsx --test tests/diagnostics/youtube/diagnose-payload.test.ts
 */

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { parseTranscriptPayload } from "@/server/youtube/segments";

const VIDEO_ID = "FRI78tq9Eik";
const BASE_URL = `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`;
const FORMATS = ["json3", "vtt", "ttml", "srv3", "srv1"] as const;
const TIMEOUT_MS = 15_000;

const shouldRun = process.env.DIAGNOSE === "1";

test("diagnose caption payloads for specific video", { skip: !shouldRun }, async () => {
  for (const fmt of FORMATS) {
    const url = `${BASE_URL}&fmt=${fmt}`;
    console.log(`\n--- Fetching fmt=${fmt} ---`);
    console.log(`URL: ${url}`);

    let rawPayload: string;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      console.log(`Status: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get("content-type")}`);

      rawPayload = await response.text();
    } catch (error) {
      console.log(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    console.log(`Payload length: ${rawPayload.length}`);
    console.log(`First 300 chars: ${rawPayload.slice(0, 300)}`);

    const outPath = `/tmp/caption-payload-${fmt}.txt`;
    writeFileSync(outPath, rawPayload, "utf-8");
    console.log(`Saved to: ${outPath}`);

    const result = parseTranscriptPayload(rawPayload);
    console.log(`Parsed: ${result.parsed}, Segments: ${result.segments.length}`);

    if (result.segments.length > 0) {
      console.log(`First segment: ${JSON.stringify(result.segments[0])}`);
    }
  }

  // Also try the base URL without any fmt parameter
  console.log("\n--- Fetching without fmt ---");
  const noFmtUrl = `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`;
  try {
    const response = await fetch(noFmtUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get("content-type")}`);

    const rawPayload = await response.text();
    console.log(`Payload length: ${rawPayload.length}`);
    console.log(`First 300 chars: ${rawPayload.slice(0, 300)}`);

    writeFileSync("/tmp/caption-payload-nofmt.txt", rawPayload, "utf-8");
    console.log("Saved to: /tmp/caption-payload-nofmt.txt");

    const result = parseTranscriptPayload(rawPayload);
    console.log(`Parsed: ${result.parsed}, Segments: ${result.segments.length}`);
  } catch (error) {
    console.log(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }

  assert.ok(true, "Diagnostic complete — check console output and /tmp/caption-payload-*.txt files");
});
