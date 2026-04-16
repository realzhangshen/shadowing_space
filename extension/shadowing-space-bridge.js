// Content script injected on Shadowing Space pages (production, localhost, custom).
// On every page load it checks chrome.storage.local for a pending handoff
// envelope written by the popup, and posts it into the page until the React
// app acknowledges it (or until we hit a timeout).
//
// Why this design:
// - The popup closes the moment the new import tab takes focus, so any retry
//   loop in the popup itself dies prematurely.
// - The bridge loads on the destination tab independently of the popup's
//   lifecycle, so it can keep retrying.
// - postMessage is a fire-and-forget channel — if React hasn't mounted its
//   listener yet, the message is lost. We retry every 500ms to bridge that gap.
// - Older deployments of the React app don't send "ack" messages back. The
//   bridge keeps retrying until MAX_ATTEMPTS regardless, and the React side
//   uses an in-flight ref to dedupe repeated postMessage deliveries.

const HANDOFF_STORAGE_KEY = "pendingExtensionPayload";
const HANDOFF_TTL_MS = 60_000;
const MAX_ATTEMPTS = 30;
const RETRY_INTERVAL_MS = 500;
const ACK_TYPE = "shadowing-space-extension/ack";
const IMPORT_MESSAGE_TYPE = "shadowing-space-extension/import";
const LOG_PREFIX = "[SS-bridge]";

function isEnvelopeFresh(envelope, now) {
  if (!envelope || typeof envelope !== "object") return false;
  if (envelope.version !== 1) return false;
  if (typeof envelope.createdAt !== "number") return false;
  if (!envelope.payload || typeof envelope.payload !== "object") return false;
  return now - envelope.createdAt <= HANDOFF_TTL_MS;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function deliverHandoff() {
  let stored;
  try {
    stored = await chrome.storage.local.get(HANDOFF_STORAGE_KEY);
  } catch (error) {
    console.warn(LOG_PREFIX, "storage.get failed", error);
    return;
  }

  const envelope = stored?.[HANDOFF_STORAGE_KEY];
  if (!envelope) return;

  if (!isEnvelopeFresh(envelope, Date.now())) {
    console.info(LOG_PREFIX, "stale envelope, removing", { createdAt: envelope?.createdAt });
    await chrome.storage.local.remove(HANDOFF_STORAGE_KEY).catch(() => {});
    return;
  }

  console.info(LOG_PREFIX, "delivering handoff", {
    segments: envelope.payload?.segments?.length ?? 0,
  });

  let acknowledged = false;
  function onAck(event) {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type !== ACK_TYPE) return;
    acknowledged = true;
    window.removeEventListener("message", onAck);
    console.info(LOG_PREFIX, "ack received");
  }
  window.addEventListener("message", onAck);

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !acknowledged; attempt += 1) {
      window.postMessage(
        { type: IMPORT_MESSAGE_TYPE, payload: envelope.payload },
        window.location.origin,
      );
      // Skip the wait on the last loop so we don't add an extra 500ms.
      if (attempt < MAX_ATTEMPTS && !acknowledged) {
        await sleep(RETRY_INTERVAL_MS);
      }
    }
  } finally {
    window.removeEventListener("message", onAck);
    await chrome.storage.local.remove(HANDOFF_STORAGE_KEY).catch(() => {});
    console.info(LOG_PREFIX, "handoff complete", { acknowledged });
  }
}

deliverHandoff().catch((error) => {
  console.error(LOG_PREFIX, "deliverHandoff threw", error);
});

// Back-compat: keep the original runtime-message path so that older popup
// builds (or future direct-push features) still work.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "shadowing-space-extension/deliver" || !message.payload) {
    return false;
  }

  window.postMessage(
    { type: IMPORT_MESSAGE_TYPE, payload: message.payload },
    window.location.origin,
  );

  sendResponse({ ok: true });
  return false;
});
