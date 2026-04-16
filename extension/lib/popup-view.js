// Pure helpers that decide which popup view to show given the current tab URL
// and whether this is the user's first time opening the popup. Kept
// dependency-free so the tests can run under Node.

const YOUTUBE_WATCH_PATTERN = /^https:\/\/www\.youtube\.com\/watch(?:\?|$)/i;
const YOUTUBE_HOST_PATTERN = /^https?:\/\/(?:www\.|m\.|music\.)?youtube\.com(?:\/|$)/i;

export function classifyTab(url) {
  if (typeof url !== "string" || url.length === 0) return "non-youtube";
  if (YOUTUBE_WATCH_PATTERN.test(url)) return "youtube-watch";
  if (YOUTUBE_HOST_PATTERN.test(url)) return "youtube-other";
  return "non-youtube";
}

export function pickPopupView({ tabKind, isFirstRun } = {}) {
  if (tabKind === "youtube-watch") {
    return { view: "ready", showIntroBanner: Boolean(isFirstRun) };
  }
  if (tabKind === "youtube-other") {
    return { view: "youtube-nudge", showIntroBanner: false };
  }
  return { view: "welcome", showIntroBanner: false };
}
