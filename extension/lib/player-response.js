// Pure helpers for reading YouTube's ytInitialPlayerResponse with fallbacks.
// Kept dependency-free so the main-world content script and Node tests share the
// exact same extraction rules.

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseJson(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pickFromYtPlayerConfig(windowLike) {
  const args = windowLike?.ytplayer?.config?.args;
  if (!isPlainObject(args)) return null;

  if (isPlainObject(args.raw_player_response)) {
    return args.raw_player_response;
  }

  const parsed = tryParseJson(args.player_response);
  if (parsed) return parsed;

  return null;
}

export function readPlayerResponse(windowLike) {
  if (!isPlainObject(windowLike) && windowLike !== globalThis) {
    // Allow either "a bag of properties" for testing or a real window reference.
    if (typeof windowLike !== "object" || windowLike === null) {
      return null;
    }
  }

  const initial = windowLike?.ytInitialPlayerResponse;
  if (isPlainObject(initial)) {
    return initial;
  }

  const fromConfig = pickFromYtPlayerConfig(windowLike);
  if (fromConfig) {
    return fromConfig;
  }

  // Newer YouTube UIs occasionally expose player data on the ytd-watch-flexy element.
  try {
    const flexy = windowLike?.document?.querySelector?.("ytd-watch-flexy");
    const flexyResponse =
      flexy?.playerData?.playerResponse ?? flexy?.__data?.playerData?.playerResponse;
    if (isPlainObject(flexyResponse)) {
      return flexyResponse;
    }
  } catch {
    // querySelector can throw in non-DOM environments; ignore and keep walking.
  }

  return null;
}

export function hasUsableCaptionTracks(playerResponse) {
  if (!isPlainObject(playerResponse)) return false;
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) && tracks.length > 0;
}

function languageMatches(track, languageCode) {
  if (!languageCode) return false;
  return new RegExp(`^${languageCode}(?:-|$)`, "i").test(track?.languageCode ?? "");
}

export function chooseCaptionTrack(tracks, options = {}) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  const preferredLanguage = options.preferredLanguage ?? "en";

  const manualPreferred = tracks.find(
    (track) => languageMatches(track, preferredLanguage) && track?.kind !== "asr",
  );
  if (manualPreferred) return manualPreferred;

  const anyPreferred = tracks.find((track) => languageMatches(track, preferredLanguage));
  if (anyPreferred) return anyPreferred;

  const manualFallback = tracks.find((track) => track?.kind !== "asr");
  if (manualFallback) return manualFallback;

  return tracks[0] ?? null;
}
