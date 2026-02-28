import { AppError } from "@/server/errors";
import type { RequestLogger } from "@/server/logger";
import { describeFetchError, fetchWithTimeout, SHARED_HEADERS } from "@/server/http";

export async function fetchWatchPage(
  videoId: string,
  timeoutMs: number,
  logger?: RequestLogger
): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      watchUrl,
      {
        headers: SHARED_HEADERS
      },
      timeoutMs
    );
  } catch (error) {
    throw new AppError(describeFetchError(error, "Unable to reach YouTube watch page"), 502);
  }

  if (!response.ok) {
    throw new AppError(`Unable to reach YouTube watch page (HTTP ${response.status})`, 502);
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
  logContext: Record<string, unknown> = {}
): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: SHARED_HEADERS
      },
      timeoutMs
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
  logger?: RequestLogger
): Promise<unknown> {
  const url = "https://www.youtube.com/youtubei/v1/player";

  let response: Response;
  try {
    response = await fetchWithTimeout(
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
      timeoutMs
    );
  } catch (error) {
    throw new AppError(describeFetchError(error, "Unable to reach YouTube Innertube API"), 502);
  }

  if (!response.ok) {
    throw new AppError(`Unable to reach YouTube Innertube API (HTTP ${response.status})`, 502);
  }

  logger?.debug("youtube.innertube_player.response", {
    videoId,
    status: response.status,
    contentType: response.headers.get("content-type")
  });

  const json: unknown = await response.json();
  return json;
}
