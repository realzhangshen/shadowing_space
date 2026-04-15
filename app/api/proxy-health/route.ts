import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import {
  clientIpFromRequest,
  describeFetchError,
  fetchWithProxy,
  SHARED_HEADERS,
} from "@/server/http";
import { createRequestLogger } from "@/server/logger";
import { checkRateLimit, rateLimitHeaders } from "@/server/rateLimit";
import type { ProxyHealthResponse } from "@/types/api";

const PROBE_URL = "https://www.youtube.com/robots.txt";
const PROBE_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

let cachedResult: { data: ProxyHealthResponse; ts: number } | null = null;

async function probeProxy(): Promise<ProxyHealthResponse> {
  const proxyUrl = env.pickYoutubeProxyUrl();
  const proxyConfigured = proxyUrl !== undefined;
  const checkedAt = new Date().toISOString();

  if (!proxyConfigured) {
    return {
      status: "degraded",
      proxyConfigured: false,
      latencyMs: null,
      httpStatus: null,
      checkedAt,
      cached: false,
      error: "No proxy configured",
    };
  }

  try {
    const start = performance.now();
    const res = await fetchWithProxy(
      PROBE_URL,
      { method: "GET", headers: SHARED_HEADERS },
      PROBE_TIMEOUT_MS,
      proxyUrl,
    );
    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      return {
        status: "ok",
        proxyConfigured: true,
        latencyMs,
        httpStatus: res.status,
        checkedAt,
        cached: false,
        error: null,
      };
    }

    return {
      status: "degraded",
      proxyConfigured: true,
      latencyMs,
      httpStatus: res.status,
      checkedAt,
      cached: false,
      error: `Upstream returned HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      status: "down",
      proxyConfigured: true,
      latencyMs: null,
      httpStatus: null,
      checkedAt,
      cached: false,
      error: describeFetchError(error, "Proxy request failed"),
    };
  }
}

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const logger = createRequestLogger({ requestId, route: "/api/proxy-health" });
  const ip = clientIpFromRequest(request);

  const limit = checkRateLimit(`${ip}:proxy-health`, 10, 60_000);
  const headers = {
    ...rateLimitHeaders(limit),
    "Cache-Control": "no-store",
    "x-request-id": requestId,
  };

  if (!limit.allowed) {
    logger.warn("request.rate_limited", { ip });
    return NextResponse.json(
      { message: "Too many requests, please retry later", requestId },
      { status: 429, headers },
    );
  }

  if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL_MS) {
    logger.debug("request.cache_hit", { ip });
    return NextResponse.json({ ...cachedResult.data, cached: true }, { status: 200, headers });
  }

  const result = await probeProxy();
  cachedResult = { data: result, ts: Date.now() };

  logger.info("request.complete", { status: result.status });
  return NextResponse.json(result, { status: 200, headers });
}
