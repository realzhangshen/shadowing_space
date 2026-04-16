// Pure helpers for the extension's popup → import-page handoff.
//
// The handoff uses chrome.storage.local as an intermediate because the popup
// closes the moment the new import tab takes focus, which kills any direct
// retry loop in popup.js. Writing an envelope to storage and letting the
// destination page's bridge content script pick it up on load decouples the
// popup lifecycle from the actual delivery.

export const HANDOFF_STORAGE_KEY = "pendingExtensionPayload";
export const HANDOFF_TTL_MS = 60_000;

export function createEnvelope(payload, now = Date.now()) {
  return {
    version: 1,
    createdAt: now,
    payload,
  };
}

export function isEnvelopeFresh(envelope, now = Date.now(), ttlMs = HANDOFF_TTL_MS) {
  if (!envelope || typeof envelope !== "object") return false;
  if (envelope.version !== 1) return false;
  if (typeof envelope.createdAt !== "number") return false;
  if (!envelope.payload || typeof envelope.payload !== "object") return false;
  return now - envelope.createdAt <= ttlMs;
}
