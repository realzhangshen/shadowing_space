import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { createRequestLogger } from "@/server/logger";
import { checkRateLimit, rateLimitHeaders } from "@/server/rateLimit";
import { fetchTranscriptMetadata } from "@/server/youtube/service";

const requestSchema = z.object({
  url: z.string().trim().min(1),
  preferredLanguage: z.string().trim().min(2).max(16).optional().default("en"),
  useProxy: z.boolean().optional().default(true),
});

// Trusts Vercel's x-forwarded-for (safe on Vercel, spoofable if self-hosted behind untrusted proxies).
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
    let statusCode: number;
    let message: string;
    let errorCode: string | undefined;
    let details: Record<string, unknown> | undefined;

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      message = error.message;
      errorCode = error.errorCode;
      details = error.details;
    } else if (error instanceof ZodError) {
      statusCode = 400;
      message = "Invalid request body";
      details = { fields: error.flatten().fieldErrors };
    } else if (error instanceof SyntaxError) {
      statusCode = 400;
      message = "Malformed JSON in request body";
    } else {
      statusCode = 500;
      message = "Internal server error";
    }

    logger.error("request.failed", {
      statusCode,
      message,
      errorCode,
      error,
    });

    return NextResponse.json(
      {
        message,
        requestId,
        ...(errorCode && { errorCode }),
        ...(details && Object.keys(details).length > 0 && { details }),
      },
      {
        status: statusCode,
        headers,
      },
    );
  }
}
