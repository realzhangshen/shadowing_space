function readPositiveInteger(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function readString(rawValue: string | undefined, fallback: string): string {
  const trimmed = rawValue?.trim();
  return trimmed ? trimmed : fallback;
}

function parseProxyUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const youtubeProxyUrls = parseProxyUrls(process.env.YOUTUBE_PROXY_URLS);

export const env = {
  youtubeFetchTimeoutMs: readPositiveInteger(
    process.env.YOUTUBE_FETCH_TIMEOUT_MS ?? process.env.HTTP_FETCH_TIMEOUT_MS,
    15_000
  ),
  transcriptRateLimitMaxRequests: readPositiveInteger(process.env.TRANSCRIPT_RATE_LIMIT_MAX_REQUESTS, 30),
  transcriptRateLimitWindowMs: readPositiveInteger(process.env.TRANSCRIPT_RATE_LIMIT_WINDOW_MS, 60_000),
  trackTokenSecret: readString(process.env.TRACK_TOKEN_SECRET, "shadowing-dev-secret"),
  trackTokenTtlSeconds: readPositiveInteger(process.env.TRACK_TOKEN_TTL_SECONDS, 86_400),
  pickYoutubeProxyUrl(): string | undefined {
    if (youtubeProxyUrls.length === 0) return undefined;
    return youtubeProxyUrls[Math.floor(Math.random() * youtubeProxyUrls.length)];
  }
};
