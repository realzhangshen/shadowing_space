import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { createRequestLogger } from "@/server/logger";
import { checkRateLimit, rateLimitHeaders } from "@/server/rateLimit";
import { fetchTranscriptMetadata } from "@/server/youtube/service";

const requestSchema = z.object({
  url: z.string().trim().min(1),
  preferredLanguage: z.string().trim().min(2).max(16).optional().default("en"),
  useProxy: z.boolean().optional().default(true)
});

function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  return "unknown";
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const logger = createRequestLogger({
    requestId,
    route: "/api/youtube/transcript/fetch"
  });
  const ip = clientIpFromRequest(request);
  logger.debug("request.received", { ip });

  const limit = checkRateLimit(
    `${ip}:fetch`,
    env.transcriptRateLimitMaxRequests,
    env.transcriptRateLimitWindowMs
  );

  const headers = {
    ...rateLimitHeaders(limit),
    "Cache-Control": "no-store",
    "x-request-id": requestId
  };

  if (!limit.allowed) {
    logger.warn("request.rate_limited", {
      ip,
      limit: limit.limit,
      remaining: limit.remaining,
      resetAt: limit.resetAt
    });

    return NextResponse.json(
      { message: "Too many requests, please retry later", requestId },
      {
        status: 429,
        headers
      }
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
      proxyUrl: payload.useProxy ? env.pickYoutubeProxyUrl() : undefined
    });

    logger.info("request.succeeded", {
      videoId: data.videoId,
      trackCount: data.tracks.length,
      defaultTrackFound: Boolean(data.defaultTrackToken)
    });

    return NextResponse.json(data, {
      status: 200,
      headers
    });
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 400;
    const message =
      error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Request failed";
    const errorCode = error instanceof AppError ? error.errorCode : undefined;
    const details = error instanceof AppError ? error.details : undefined;

    logger.error("request.failed", {
      statusCode,
      message,
      errorCode,
      error
    });

    return NextResponse.json(
      { message, requestId, ...(errorCode && { errorCode }), ...(details && Object.keys(details).length > 0 && { details }) },
      {
        status: statusCode,
        headers
      }
    );
  }
}
