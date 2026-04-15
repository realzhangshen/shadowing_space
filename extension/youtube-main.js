(function () {
  const EXTRACTION_REQUEST_EVENT = "shadowing-space-extension:extract-request";
  const EXTRACTION_RESULT_TYPE = "shadowing-space-extension/extract-result";

  function getPlayerResponse() {
    const candidates = [
      window.ytInitialPlayerResponse,
      window.ytplayer?.config?.args?.raw_player_response,
      window.ytplayer?.bootstrapWebPlayerContextConfig?.jsUrl ? window.ytInitialPlayerResponse : null,
    ];

    return candidates.find(Boolean) ?? null;
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
      if (merged) {
        return merged;
      }
    }
    return fallback;
  }

  function normalizeText(raw) {
    return raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function chooseTrack(captionTracks) {
    const manualEnglish = captionTracks.find(
      (track) => /^en(?:-|$)/i.test(track.languageCode ?? "") && track.kind !== "asr",
    );
    if (manualEnglish) return manualEnglish;

    const manualDefault = captionTracks.find((track) => track.kind !== "asr");
    if (manualDefault) return manualDefault;

    const englishAuto = captionTracks.find((track) => /^en(?:-|$)/i.test(track.languageCode ?? ""));
    if (englishAuto) return englishAuto;

    return captionTracks[0] ?? null;
  }

  function parseJson3Segments(payloadText) {
    const payload = JSON.parse(payloadText);
    if (!Array.isArray(payload.events)) {
      return [];
    }

    return payload.events
      .filter((event) => Array.isArray(event.segs) && event.tStartMs !== undefined)
      .map((event) => {
        const startMs = Number(event.tStartMs);
        const durationMs = Number(event.dDurationMs ?? 0);
        const text = normalizeText(
          event.segs
            .map((segment) => decodeHtml(segment.utf8 ?? segment.text ?? ""))
            .join(""),
        );

        return {
          startMs,
          endMs: startMs + Math.max(durationMs || 1_600, 200),
          text,
        };
      })
      .filter((segment) => Number.isFinite(segment.startMs) && segment.endMs > segment.startMs && segment.text);
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
      .filter((segment) => Number.isFinite(segment.startMs) && segment.endMs > segment.startMs && segment.text);
  }

  async function fetchTrackSegments(baseUrl) {
    const candidates = [];
    const url = new URL(baseUrl);
    const noFmt = new URL(url);
    noFmt.searchParams.delete("fmt");
    candidates.push(noFmt.toString());

    const json3 = new URL(url);
    json3.searchParams.set("fmt", "json3");
    candidates.push(json3.toString());

    const original = url.toString();
    if (!candidates.includes(original)) {
      candidates.push(original);
    }

    let lastErrorMessage = "No usable caption payload was returned by YouTube.";

    for (const candidateUrl of candidates) {
      const response = await fetch(candidateUrl, {
        credentials: "include",
      });

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
        if (jsonSegments.length > 0) {
          return jsonSegments;
        }
      } catch {
        // Fall through to XML parsing.
      }

      const xmlSegments = parseXmlSegments(payloadText);
      if (xmlSegments.length > 0) {
        return xmlSegments;
      }

      lastErrorMessage = "Caption payload could not be parsed.";
    }

    throw new Error(lastErrorMessage);
  }

  async function extractPayload() {
    const playerResponse = getPlayerResponse();
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(captions) || captions.length === 0) {
      throw new Error("No caption tracks were found for this video.");
    }

    const track = chooseTrack(captions);
    if (!track?.baseUrl || !track.languageCode) {
      throw new Error("The selected caption track is missing required metadata.");
    }

    const videoDetails = playerResponse?.videoDetails;
    const videoId = videoDetails?.videoId || new URL(window.location.href).searchParams.get("v");
    if (!videoId) {
      throw new Error("Unable to determine the YouTube video ID.");
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
