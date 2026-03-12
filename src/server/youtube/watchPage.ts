import { AppError, YouTubeUpstreamError } from "@/server/errors";
import type { RequestLogger } from "@/server/logger";
import { describeFetchError, fetchWithProxy, SHARED_HEADERS } from "@/server/http";

export function extractInnertubeApiKey(html: string): string | null {
  const match = html.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

export function extractPlayerResponseFromHtml(html: string): unknown | null {
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s|<\/script)/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export async function fetchWatchPage(
  videoId: string,
  timeoutMs: number,
  logger?: RequestLogger,
  proxyUrl?: string
): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;

  let response: Response;
  try {
    response = await fetchWithProxy(
      watchUrl,
      {
        headers: SHARED_HEADERS
      },
      timeoutMs,
      proxyUrl
    );
  } catch (error) {
    const networkCause = describeFetchError(error, "network error");
    throw new YouTubeUpstreamError(videoId, "watch_page", undefined, networkCause);
  }

  if (!response.ok) {
    throw new YouTubeUpstreamError(videoId, "watch_page", response.status);
  }

  logger?.debug("youtube.watch_page.response", {
    videoId,
    status: response.status,
    contentType: response.headers.get("content-type")
  });

  const html = await response.text();
  logger?.debug("youtube.watch_page.size", {
    videoId,
    bodySize: html.length
  });

  return html;
}

export async function fetchCaptionPayload(
  url: string,
  timeoutMs: number,
  logger?: RequestLogger,
  logContext: Record<string, unknown> = {},
  proxyUrl?: string
): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithProxy(
      url,
      {
        headers: SHARED_HEADERS
      },
      timeoutMs,
      proxyUrl
    );
  } catch (error) {
    throw new AppError(describeFetchError(error, "Failed to fetch caption payload"), 502);
  }

  if (!response.ok) {
    throw new AppError(`Failed to fetch caption payload (HTTP ${response.status})`, 502);
  }

  logger?.debug("youtube.caption_payload.response", {
    ...logContext,
    status: response.status,
    contentType: response.headers.get("content-type")
  });

  const payload = await response.text();
  logger?.debug("youtube.caption_payload.size", {
    ...logContext,
    bodySize: payload.length
  });

  return payload;
}

export async function fetchInnertubePlayer(
  videoId: string,
  timeoutMs: number,
  logger?: RequestLogger,
  proxyUrl?: string
): Promise<unknown> {
  const url = "https://www.youtube.com/youtubei/v1/player";

  let response: Response;
  try {
    response = await fetchWithProxy(
      url,
      {
        method: "POST",
        headers: {
          ...SHARED_HEADERS,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38"
            }
          },
          videoId
        })
      },
      timeoutMs,
      proxyUrl
    );
  } catch (error) {
    const networkCause = describeFetchError(error, "network error");
    throw new YouTubeUpstreamError(videoId, "innertube_direct", undefined, networkCause);
  }

  if (!response.ok) {
    throw new YouTubeUpstreamError(videoId, "innertube_direct", response.status);
  }

  logger?.debug("youtube.innertube_player.response", {
    videoId,
    status: response.status,
    contentType: response.headers.get("content-type")
  });

  const json: unknown = await response.json();
  return json;
}

export async function fetchInnertubePlayerWithKey(
  videoId: string,
  apiKey: string,
  timeoutMs: number,
  logger?: RequestLogger,
  proxyUrl?: string
): Promise<unknown> {
  const url = `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetchWithProxy(
      url,
      {
        method: "POST",
        headers: {
          ...SHARED_HEADERS,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38"
            }
          },
          videoId
        })
      },
      timeoutMs,
      proxyUrl
    );
  } catch (error) {
    const networkCause = describeFetchError(error, "network error");
    throw new YouTubeUpstreamError(videoId, "innertube_with_key", undefined, networkCause);
  }

  if (!response.ok) {
    throw new YouTubeUpstreamError(videoId, "innertube_with_key", response.status);
  }

  logger?.debug("youtube.innertube_player_with_key.response", {
    videoId,
    status: response.status,
    contentType: response.headers.get("content-type")
  });

  const json: unknown = await response.json();
  return json;
}
