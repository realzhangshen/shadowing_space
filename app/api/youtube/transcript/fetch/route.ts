import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/env";
import { toErrorResponse } from "@/server/errors";
import { clientIpFromRequest } from "@/server/http";
import { createRequestLogger } from "@/server/logger";
import { checkRateLimit, rateLimitHeaders } from "@/server/rateLimit";
import { fetchTranscriptMetadata } from "@/server/youtube/service";

const requestSchema = z.object({
  url: z.string().trim().min(1),
  preferredLanguage: z.string().trim().min(2).max(16).optional().default("en"),
  useProxy: z.boolean().optional().default(true),
});

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const logger = createRequestLogger({
    requestId,
    route: "/api/youtube/transcript/fetch",
  });
  const ip = clientIpFromRequest(request);
  logger.debug("request.received", { ip });

  const limit = checkRateLimit(
    `${ip}:fetch`,
    env.transcriptRateLimitMaxRequests,
    env.transcriptRateLimitWindowMs,
  );

  const headers = {
    ...rateLimitHeaders(limit),
    "Cache-Control": "no-store",
    "x-request-id": requestId,
  };

  if (!limit.allowed) {
    logger.warn("request.rate_limited", {
      ip,
      limit: limit.limit,
      remaining: limit.remaining,
      resetAt: limit.resetAt,
    });

    return NextResponse.json(
      { message: "Too many requests, please retry later", requestId },
      {
        status: 429,
        headers,
      },
    );
  }

  try {
    const payload = requestSchema.parse(await request.json());
    logger.debug("request.validated", { preferredLanguage: payload.preferredLanguage });

    const data = await fetchTranscriptMetadata({
      url: payload.url,
      preferredLanguage: payload.preferredLanguage,
      timeoutMs: env.youtubeFetchTimeoutMs,
      trackTokenSecret: env.trackTokenSecret,
      trackTokenTtlSeconds: env.trackTokenTtlSeconds,
      logger,
      proxyUrl: payload.useProxy ? env.pickYoutubeProxyUrl() : undefined,
    });

    logger.info("request.succeeded", {
      videoId: data.videoId,
      trackCount: data.tracks.length,
      defaultTrackFound: Boolean(data.defaultTrackToken),
    });

    return NextResponse.json(data, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error("request.failed", { error });
    return toErrorResponse(error, requestId, headers);
  }
}
