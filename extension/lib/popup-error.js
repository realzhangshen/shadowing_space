// Maps raw error values (Error instances, strings, null) to a structured,
// user-friendly shape the popup can render as an inline error card.

const REFRESH_TAB_ACTION = { kind: "refresh-tab", label: "Refresh YouTube tab" };
const OPEN_OPTIONS_ACTION = { kind: "open-options", label: "Open Options" };

function extractMessage(raw) {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && typeof raw.message === "string") return raw.message;
  return String(raw);
}

export function mapPopupError(raw) {
  const message = extractMessage(raw).trim();

  if (/can't reach the youtube tab|content script unreachable/i.test(message)) {
    return {
      kind: "content-script-unreachable",
      title: "Can't reach this YouTube tab",
      body: "Refresh the page and click the toolbar icon again.",
      action: REFRESH_TAB_ACTION,
    };
  }

  if (/no track selected/i.test(message)) {
    return {
      kind: "no-track-selected",
      title: "Pick a caption track first",
      body: "Select one of the tracks above, then try again.",
      action: null,
    };
  }

  if (/could not read caption tracks|extraction failed/i.test(message)) {
    return {
      kind: "extraction-failed",
      title: "Couldn't read this video's captions",
      body: "YouTube may be blocking this one. Refresh the tab or try a different caption track.",
      action: REFRESH_TAB_ACTION,
    };
  }

  if (/permission denied/i.test(message)) {
    return {
      kind: "permission-denied",
      title: "Permission needed to reach that destination",
      body: "Open Options and approve the host permission, or pick the default destination.",
      action: OPEN_OPTIONS_ACTION,
    };
  }

  return {
    kind: "unknown",
    title: "Something went wrong",
    body: message || "Please try again.",
    action: null,
  };
}
