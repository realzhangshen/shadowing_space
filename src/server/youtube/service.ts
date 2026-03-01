import type { FetchTranscriptResponse, ResolveTranscriptResponse } from "@/types/api";
import {
  AppError,
  CaptionContentEmptyError,
  CaptionParsingFailedError,
  InvalidVideoUrlError,
  NoCaptionTracksError,
  TrackTokenInvalidError
} from "@/server/errors";
import type { RequestLogger } from "@/server/logger";
import { mergeSegments, parseTranscriptPayload } from "@/server/youtube/segments";
import { parseTrackToken } from "@/server/youtube/trackToken";
import { buildTrackSummaries, type CaptionTrack } from "@/server/youtube/tracks";
import { parseStrictYouTubeVideoId } from "@/server/youtube/url";
import {
  extractInnertubeApiKey,
  extractPlayerResponseFromHtml,
  fetchCaptionPayload,
  fetchInnertubePlayer,
  fetchInnertubePlayerWithKey,
  fetchWatchPage
} from "@/server/youtube/watchPage";

type PlayerResponse = {
  videoDetails?: {
    title?: string;
    lengthSeconds?: string;
    thumbnail?: {
      thumbnails?: Array<{ url?: string }>;
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

function asPlayerResponse(data: unknown): PlayerResponse {
  if (typeof data !== "object" || data === null) {
    throw new AppError("Unable to parse YouTube player metadata", 502);
  }
  return data as PlayerResponse;
}

function hasCaptionTracks(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const player = data as PlayerResponse;
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) && tracks.length > 0;
}

function parseDurationSec(value: string | undefined): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

function buildCandidateUrls(baseUrl: string): string[] {
  const candidateUrls: string[] = [];

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return [baseUrl];
  }

  // Primary: strip `fmt` param to fetch default XML (what working libraries do)
  const noFmt = new URL(parsed);
  noFmt.searchParams.delete("fmt");
  candidateUrls.push(noFmt.toString());

  // Fallback: try fmt=json3
  const json3 = new URL(parsed);
  json3.searchParams.set("fmt", "json3");
  candidateUrls.push(json3.toString());

  // Final: original URL as-is (if different from above)
  const original = parsed.toString();
  if (!candidateUrls.includes(original)) {
    candidateUrls.push(original);
  }

  return candidateUrls;
}

function summarizeCaptionUrl(url: string): Record<string, unknown> {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    path: parsed.pathname,
    fmt: parsed.searchParams.get("fmt"),
    lang: parsed.searchParams.get("lang"),
    kind: parsed.searchParams.get("kind")
  };
}

export async function fetchTranscriptMetadata(params: {
  url: string;
  preferredLanguage: string;
  timeoutMs: number;
  trackTokenSecret: string;
  trackTokenTtlSeconds: number;
  logger?: RequestLogger;
  proxyUrl?: string;
}): Promise<FetchTranscriptResponse> {
  const { url, preferredLanguage, timeoutMs, trackTokenSecret, trackTokenTtlSeconds, logger, proxyUrl } = params;
  logger?.debug("youtube.fetch_metadata.start", { url, preferredLanguage });

  const videoId = parseStrictYouTubeVideoId(url);
  if (!videoId) {
    throw new InvalidVideoUrlError(url);
  }

  let playerData: unknown = null;
  const strategiesAttempted: string[] = [];
  let html = "";

  // Strategy 1: Direct Android Innertube (produces working caption URLs)
  try {
    playerData = await fetchInnertubePlayer(videoId, timeoutMs, logger, proxyUrl);
    strategiesAttempted.push("innertube_direct");
    if (hasCaptionTracks(playerData)) {
      logger?.info("youtube.fetch_metadata.strategy", { strategy: "innertube_direct", videoId });
    }
  } catch (error) {
    strategiesAttempted.push("innertube_direct");
    logger?.warn("youtube.fetch_metadata.innertube_direct_failed", {
      videoId,
      message: error instanceof Error ? error.message : "unknown"
    });
  }

  // Strategy 2: Parse ytInitialPlayerResponse from watch page HTML
  if (!hasCaptionTracks(playerData)) {
    try {
      html = await fetchWatchPage(videoId, timeoutMs, logger, proxyUrl);
      playerData = extractPlayerResponseFromHtml(html);
      strategiesAttempted.push("html");
      if (hasCaptionTracks(playerData)) {
        logger?.info("youtube.fetch_metadata.strategy", { strategy: "html_player_response", videoId });
      }
    } catch (error) {
      strategiesAttempted.push("html");
      logger?.warn("youtube.fetch_metadata.watch_page_failed", {
        videoId,
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  // Strategy 3: Extract API key from page, call Innertube with key
  if (!hasCaptionTracks(playerData)) {
    if (!html) {
      try {
        html = await fetchWatchPage(videoId, timeoutMs, logger, proxyUrl);
      } catch {
        // html stays empty, apiKey extraction will be skipped
      }
    }
    const apiKey = html ? extractInnertubeApiKey(html) : null;
    if (apiKey) {
      try {
        playerData = await fetchInnertubePlayerWithKey(videoId, apiKey, timeoutMs, logger, proxyUrl);
        strategiesAttempted.push("innertube_with_key");
        if (hasCaptionTracks(playerData)) {
          logger?.info("youtube.fetch_metadata.strategy", { strategy: "innertube_with_key", videoId });
        }
      } catch (error) {
        strategiesAttempted.push("innertube_with_key");
        logger?.warn("youtube.fetch_metadata.innertube_with_key_failed", {
          videoId,
          message: error instanceof Error ? error.message : "unknown"
        });
      }
    }
  }

  const playerResponse = asPlayerResponse(playerData);
  const rawTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (rawTracks.length === 0) {
    throw new NoCaptionTracksError(videoId, strategiesAttempted);
  }

  logger?.debug("youtube.fetch_metadata.track_candidates", {
    videoId,
    trackCount: rawTracks.length
  });

  const { tracks, defaultTrackToken } = buildTrackSummaries({
    videoId,
    rawTracks,
    preferredLanguage,
    tokenSecret: trackTokenSecret,
    tokenTtlSeconds: trackTokenTtlSeconds
  });

  const durationSec = parseDurationSec(playerResponse.videoDetails?.lengthSeconds);
  const thumbnails = playerResponse.videoDetails?.thumbnail?.thumbnails ?? [];
  const thumbnailUrl = [...thumbnails].reverse().find((item) => typeof item.url === "string" && item.url)?.url;
  const defaultTrack = tracks.find((track) => track.token === defaultTrackToken);

  logger?.debug("youtube.fetch_metadata.success", {
    videoId,
    trackCount: tracks.length,
    defaultLanguageCode: defaultTrack?.languageCode,
    defaultIsAutoGenerated: defaultTrack?.isAutoGenerated ?? false
  });

  return {
    videoId,
    title: playerResponse.videoDetails?.title ?? `YouTube ${videoId}`,
    durationSec,
    thumbnailUrl,
    tracks,
    defaultTrackToken
  };
}

export async function resolveTranscriptSegments(params: {
  videoId: string;
  trackToken: string;
  timeoutMs: number;
  trackTokenSecret: string;
  logger?: RequestLogger;
  proxyUrl?: string;
}): Promise<ResolveTranscriptResponse> {
  const { videoId, trackToken, timeoutMs, trackTokenSecret, logger, proxyUrl } = params;
  logger?.debug("youtube.resolve_segments.start", {
    videoId,
    trackTokenPrefix: trackToken.slice(0, 10)
  });

  const payload = parseTrackToken(trackToken, trackTokenSecret);
  if (payload.videoId !== videoId) {
    throw new TrackTokenInvalidError("wrong_video");
  }

  logger?.debug("youtube.resolve_segments.track_token", {
    videoIdFromToken: payload.videoId,
    languageCode: payload.languageCode,
    isAutoGenerated: payload.isAutoGenerated,
    expiresAt: payload.expiresAt
  });

  const candidateUrls = buildCandidateUrls(payload.baseUrl);
  logger?.info("youtube.resolve_segments.base_url", {
    videoId,
    baseUrl: payload.baseUrl
  });
  logger?.debug("youtube.resolve_segments.candidates", {
    candidateCount: candidateUrls.length,
    candidates: candidateUrls.map((url) => summarizeCaptionUrl(url))
  });

  let lastFetchError: AppError | null = null;
  let sawParsedPayload = false;
  let sawUnsupportedPayload = false;

  for (const [index, candidateUrl] of candidateUrls.entries()) {
    let rawPayload = "";
    const attempt = index + 1;
    const candidateMeta = summarizeCaptionUrl(candidateUrl);
    logger?.debug("youtube.resolve_segments.fetch_attempt", {
      attempt,
      ...candidateMeta
    });

    try {
      rawPayload = await fetchCaptionPayload(candidateUrl, timeoutMs, logger, {
        attempt,
        ...candidateMeta
      }, proxyUrl);
    } catch (error) {
      if (error instanceof AppError) {
        lastFetchError = error;
        logger?.warn("youtube.resolve_segments.fetch_failed", {
          attempt,
          ...candidateMeta,
          statusCode: error.statusCode,
          message: error.message
        });
        continue;
      }
      throw error;
    }

    const { parsed, segments } = parseTranscriptPayload(rawPayload);
    logger?.debug("youtube.resolve_segments.parse_result", {
      attempt,
      ...candidateMeta,
      parsed,
      segmentCount: segments.length
    });

    if (!parsed) {
      sawUnsupportedPayload = true;
      logger?.warn("youtube.resolve_segments.payload_preview", {
        attempt,
        ...candidateMeta,
        payloadLength: rawPayload.length,
        payloadSnippet: rawPayload.slice(0, 500),
        contentStartsWithBrace: rawPayload.trimStart().startsWith("{"),
        contentStartsWithAngle: rawPayload.trimStart().startsWith("<"),
      });
      continue;
    }

    sawParsedPayload = true;
    if (segments.length === 0) {
      continue;
    }

    const mergedSegments = mergeSegments(segments);

    logger?.debug("youtube.resolve_segments.success", {
      videoId,
      languageCode: payload.languageCode,
      isAutoGenerated: payload.isAutoGenerated,
      segmentCount: mergedSegments.length
    });

    return {
      videoId,
      track: {
        token: trackToken,
        languageCode: payload.languageCode,
        label: payload.label,
        isAutoGenerated: payload.isAutoGenerated
      },
      segments: mergedSegments
    };
  }

  if (lastFetchError && !sawParsedPayload) {
    logger?.warn("youtube.resolve_segments.abort_last_fetch_error", {
      videoId,
      statusCode: lastFetchError.statusCode,
      message: lastFetchError.message
    });
    throw lastFetchError;
  }

  if (sawParsedPayload) {
    logger?.warn("youtube.resolve_segments.empty_content", {
      videoId,
      languageCode: payload.languageCode
    });
    throw new CaptionContentEmptyError(videoId, payload.languageCode);
  }

  if (sawUnsupportedPayload) {
    logger?.warn("youtube.resolve_segments.unsupported_payload", { videoId });
    throw new CaptionParsingFailedError(videoId, "unsupported payload format");
  }

  logger?.error("youtube.resolve_segments.parsing_failed", { videoId });
  throw new CaptionParsingFailedError(videoId, "no parseable content");
}
