const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com"
]);

const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

function normalizeCandidate(candidate: string): string | null {
  const cleaned = candidate.trim();
  if (!cleaned) {
    return null;
  }

  return VIDEO_ID_PATTERN.test(cleaned) ? cleaned : null;
}

function fromPathSegment(pathname: string, marker: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const markerIndex = segments.findIndex((value) => value === marker);
  if (markerIndex < 0) {
    return null;
  }

  const next = segments[markerIndex + 1];
  return normalizeCandidate(next ?? "");
}

export function parseStrictYouTubeVideoId(input: string): string | null {
  const fromRaw = normalizeCandidate(input);
  if (fromRaw) {
    return fromRaw;
  }

  const value = input.trim();
  if (!value) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (SHORT_HOSTS.has(hostname)) {
    const segment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return normalizeCandidate(segment);
  }

  if (!YOUTUBE_HOSTS.has(hostname)) {
    return null;
  }

  if (parsed.pathname === "/watch") {
    return normalizeCandidate(parsed.searchParams.get("v") ?? "");
  }

  return (
    fromPathSegment(parsed.pathname, "embed") ||
    fromPathSegment(parsed.pathname, "shorts") ||
    fromPathSegment(parsed.pathname, "live")
  );
}
