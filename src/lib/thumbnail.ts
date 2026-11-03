const YOUTUBE_VIDEO_PATH_PATTERN = /^\/vi(_webp)?\/([A-Za-z0-9_-]{11})\/([^/]+)$/;

const YOUTUBE_THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "img.youtube.com", "ytimg.com"]);

const FALLBACK_THUMBNAIL_SIZES = ["sddefault", "hqdefault", "mqdefault", "default"] as const;

function upgradeToHttps(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return trimmed.replace(/^http:\/\//i, "https://");
}

function parseHttpsUrl(
  rawUrl: string | undefined,
): { normalized: string; parsed: URL } | undefined {
  const normalized = upgradeToHttps(rawUrl ?? "");
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") {
      return undefined;
    }
    return { normalized, parsed };
  } catch {
    return undefined;
  }
}

function isYoutubeThumbnailHost(hostname: string): boolean {
  return YOUTUBE_THUMBNAIL_HOSTS.has(hostname) || hostname.endsWith(".ytimg.com");
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Builds an ordered, de-duplicated list of thumbnail URLs to try for a video card.
 *
 * Stored YouTube thumbnail URLs (especially `maxresdefault` and `sddefault`) can 404 for
 * videos that never got high-resolution renditions, so we progressively fall back to the
 * smaller sizes that YouTube always serves. Non-YouTube URLs are returned as-is (upgraded
 * to https when they were stored as protocol-relative or plain http).
 */
export function buildThumbnailCandidates(rawUrl?: string): string[] {
  const parsedUrl = parseHttpsUrl(rawUrl);
  if (!parsedUrl) {
    return [];
  }

  const { normalized, parsed } = parsedUrl;
  const youtubeMatch = isYoutubeThumbnailHost(parsed.hostname)
    ? parsed.pathname.match(YOUTUBE_VIDEO_PATH_PATTERN)
    : null;

  if (!youtubeMatch) {
    return [normalized];
  }

  const [, , videoId, fileName] = youtubeMatch;
  const candidates = [normalized];

  if (fileName.toLowerCase().endsWith(".webp")) {
    const baseName = fileName.replace(/\.[^.]+$/, "");
    candidates.push(`https://i.ytimg.com/vi/${videoId}/${baseName}.jpg`);
  }

  for (const size of FALLBACK_THUMBNAIL_SIZES) {
    candidates.push(`https://i.ytimg.com/vi/${videoId}/${size}.jpg`);
  }

  return dedupe(candidates);
}

/**
 * Normalizes a thumbnail URL before it is persisted. Returns a trimmed https URL, or
 * undefined when the value is blank or not an http(s) URL.
 */
export function normalizeThumbnailUrl(rawUrl?: string): string | undefined {
  return parseHttpsUrl(rawUrl)?.normalized;
}
