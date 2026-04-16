// Main-world content script: runs inside https://www.youtube.com/watch pages and
// reads the Innertube player data the page already hydrated.
//
// MV3 manifest-declared content scripts cannot `import`, so the pure helper logic
// is duplicated here; the canonical version lives in extension/lib/player-response.js
// and is exercised by unit tests. Keep them in sync.
(function () {
  const EXTRACTION_REQUEST_EVENT = "shadowing-space-extension:extract-request";
  const EXTRACTION_RESULT_TYPE = "shadowing-space-extension/extract-result";

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function tryParseJson(value) {
    if (typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function readPlayerResponse() {
    const initial = window.ytInitialPlayerResponse;
    if (isPlainObject(initial)) return initial;

    const args = window.ytplayer?.config?.args;
    if (isPlainObject(args)) {
      if (isPlainObject(args.raw_player_response)) return args.raw_player_response;
      const parsed = tryParseJson(args.player_response);
      if (parsed) return parsed;
    }

    try {
      const flexy = document.querySelector("ytd-watch-flexy");
      const flexyResponse =
        flexy?.playerData?.playerResponse ?? flexy?.__data?.playerData?.playerResponse;
      if (isPlainObject(flexyResponse)) return flexyResponse;
    } catch {
      // querySelector may throw for custom elements before definition; ignore.
    }

    return null;
  }

  function getVideoIdFromLocation() {
    try {
      return new URL(window.location.href).searchParams.get("v") || null;
    } catch {
      return null;
    }
  }

  function getLabel(name, fallback) {
    if (!name) return fallback;
    if (typeof name.simpleText === "string" && name.simpleText.trim()) {
      return name.simpleText.trim();
    }
    if (Array.isArray(name.runs)) {
      const merged = name.runs
        .map((item) => item?.text ?? "")
        .join("")
        .trim();
      if (merged) return merged;
    }
    return fallback;
  }

  function normalizeText(raw) {
    return raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  }

  // HTML entity decoding without innerHTML — parses the string as an HTML
  // document and returns its textContent, which never executes script content.
  // Runs a second pass so double-encoded captions (YouTube does this) decode fully.
  function decodeHtml(value) {
    if (typeof value !== "string" || !value) return "";
    const parser = new DOMParser();
    const first = parser.parseFromString(value, "text/html").documentElement.textContent ?? "";
    if (!first.includes("&")) return first;
    return parser.parseFromString(first, "text/html").documentElement.textContent ?? first;
  }

  function languageMatches(track, languageCode) {
    if (!languageCode) return false;
    return new RegExp(`^${languageCode}(?:-|$)`, "i").test(track?.languageCode ?? "");
  }

  function chooseTrack(captionTracks, preferredLanguage = "en") {
    const manualPreferred = captionTracks.find(
      (track) => languageMatches(track, preferredLanguage) && track?.kind !== "asr",
    );
    if (manualPreferred) return manualPreferred;

    const anyPreferred = captionTracks.find((track) => languageMatches(track, preferredLanguage));
    if (anyPreferred) return anyPreferred;

    const manualFallback = captionTracks.find((track) => track?.kind !== "asr");
    if (manualFallback) return manualFallback;

    return captionTracks[0] ?? null;
  }

  function parseJson3Segments(payloadText) {
    const payload = JSON.parse(payloadText);
    if (!Array.isArray(payload.events)) return [];

    return payload.events
      .filter((event) => Array.isArray(event.segs) && event.tStartMs !== undefined)
      .map((event) => {
        const startMs = Number(event.tStartMs);
        const durationMs = Number(event.dDurationMs ?? 0);
        const text = normalizeText(
          event.segs.map((segment) => decodeHtml(segment.utf8 ?? segment.text ?? "")).join(""),
        );

        return {
          startMs,
          endMs: startMs + Math.max(durationMs || 1_600, 200),
          text,
        };
      })
      .filter(
        (segment) =>
          Number.isFinite(segment.startMs) && segment.endMs > segment.startMs && segment.text,
      );
  }

  function parseXmlSegments(payloadText) {
    const xml = new DOMParser().parseFromString(payloadText, "text/xml");
    const textNodes = Array.from(xml.querySelectorAll("text"));

    return textNodes
      .map((node) => {
        const start = Number.parseFloat(node.getAttribute("start") ?? "");
        const duration = Number.parseFloat(node.getAttribute("dur") ?? "");
        const text = normalizeText(decodeHtml(node.textContent ?? ""));

        return {
          startMs: Math.round(start * 1_000),
          endMs: Math.round((start + Math.max(duration || 1.6, 0.2)) * 1_000),
          text,
        };
      })
      .filter(
        (segment) =>
          Number.isFinite(segment.startMs) && segment.endMs > segment.startMs && segment.text,
      );
  }

  async function fetchTrackSegments(baseUrl) {
    const url = new URL(baseUrl);
    const candidates = [];

    const noFmt = new URL(url);
    noFmt.searchParams.delete("fmt");
    candidates.push(noFmt.toString());

    const json3 = new URL(url);
    json3.searchParams.set("fmt", "json3");
    candidates.push(json3.toString());

    const original = url.toString();
    if (!candidates.includes(original)) candidates.push(original);

    let lastErrorMessage = "No usable caption payload was returned by YouTube.";

    for (const candidateUrl of candidates) {
      const response = await fetch(candidateUrl, { credentials: "include" });

      if (!response.ok) {
        lastErrorMessage = `Caption request failed with HTTP ${response.status}.`;
        continue;
      }

      const payloadText = await response.text();
      if (!payloadText.trim()) {
        lastErrorMessage = "Caption payload was empty.";
        continue;
      }

      try {
        const jsonSegments = parseJson3Segments(payloadText);
        if (jsonSegments.length > 0) return jsonSegments;
      } catch {
        // Fall through to XML parsing.
      }

      const xmlSegments = parseXmlSegments(payloadText);
      if (xmlSegments.length > 0) return xmlSegments;

      lastErrorMessage = "Caption payload could not be parsed.";
    }

    throw new Error(lastErrorMessage);
  }

  async function extractPayload() {
    const expectedVideoId = getVideoIdFromLocation();
    const playerResponse = readPlayerResponse();

    if (!playerResponse) {
      throw new Error(
        "Could not read YouTube player data. Try refreshing the page — SPA navigation sometimes leaves captions unreadable until a reload.",
      );
    }

    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(captions) || captions.length === 0) {
      throw new Error("No caption tracks were found for this video.");
    }

    const videoDetails = playerResponse?.videoDetails;
    const playerVideoId = videoDetails?.videoId;
    const videoId = playerVideoId || expectedVideoId;
    if (!videoId) {
      throw new Error("Unable to determine the YouTube video ID.");
    }

    // If YouTube's SPA left stale player data behind (video id mismatch), bail out
    // rather than importing the wrong transcript. A refresh fixes this.
    if (expectedVideoId && playerVideoId && expectedVideoId !== playerVideoId) {
      throw new Error(
        `Player data is still showing the previous video (${playerVideoId}) instead of ${expectedVideoId}. Please refresh the YouTube tab and try again.`,
      );
    }

    const track = chooseTrack(captions);
    if (!track?.baseUrl || !track.languageCode) {
      throw new Error("The selected caption track is missing required metadata.");
    }

    const thumbnails = Array.isArray(videoDetails?.thumbnail?.thumbnails)
      ? videoDetails.thumbnail.thumbnails
      : [];
    const thumbnailUrl = [...thumbnails]
      .reverse()
      .find((item) => typeof item?.url === "string" && item.url)?.url;

    const segments = await fetchTrackSegments(track.baseUrl);

    return {
      version: 1,
      source: "shadowing-space-extension",
      exportedAt: new Date().toISOString(),
      video: {
        videoId,
        title: videoDetails?.title || document.title.replace(/\s*-\s*YouTube$/, ""),
        thumbnailUrl,
      },
      track: {
        languageCode: track.languageCode,
        label: getLabel(track.name, track.languageCode),
        isAutoGenerated: track.kind === "asr",
        originTrackId: track.vssId || track.languageCode,
      },
      segments,
    };
  }

  window.addEventListener(EXTRACTION_REQUEST_EVENT, () => {
    void (async () => {
      try {
        const payload = await extractPayload();
        window.postMessage(
          {
            type: EXTRACTION_RESULT_TYPE,
            ok: true,
            payload,
          },
          window.location.origin,
        );
      } catch (error) {
        window.postMessage(
          {
            type: EXTRACTION_RESULT_TYPE,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          window.location.origin,
        );
      }
    })();
  });
})();
