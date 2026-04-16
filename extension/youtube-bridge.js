// ISOLATED-world content script. Mediates between the popup/background (via
// chrome.runtime messages) and the MAIN-world script (via custom DOM events).
// All failures bubble back to the popup as response.ok=false with .error.

const LIST_REQUEST_EVENT = "shadowing-space-extension:list-request";
const EXTRACT_REQUEST_EVENT = "shadowing-space-extension:extract-request";
const LIST_RESULT_TYPE = "shadowing-space-extension/list-result";
const EXTRACT_RESULT_TYPE = "shadowing-space-extension/extract-result";
const TIMEOUT_MS = 20_000;

function waitForResponse(expectedType) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`Timed out waiting for ${expectedType}.`));
    }, TIMEOUT_MS);

    const onMessage = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== expectedType) return;

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);

      if (data.ok) {
        resolve(data);
      } else {
        reject(new Error(data.error || "Unknown main-world failure."));
      }
    };

    window.addEventListener("message", onMessage);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;

  if (type === "shadowing-space-extension/list-tracks") {
    void (async () => {
      try {
        const pending = waitForResponse(LIST_RESULT_TYPE);
        window.dispatchEvent(new CustomEvent(LIST_REQUEST_EVENT));
        const data = await pending;
        sendResponse({ ok: true, summary: data.summary });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (type === "shadowing-space-extension/extract-track") {
    const trackIndex = Number.isFinite(message?.trackIndex) ? message.trackIndex : -1;
    void (async () => {
      try {
        const pending = waitForResponse(EXTRACT_RESULT_TYPE);
        window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, { detail: { trackIndex } }));
        const data = await pending;
        sendResponse({ ok: true, payload: data.payload });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  // Legacy single-step extract event (keeps back-compat with earlier popup builds).
  if (type === "shadowing-space-extension/extract") {
    void (async () => {
      try {
        const pending = waitForResponse(EXTRACT_RESULT_TYPE);
        window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, { detail: {} }));
        const data = await pending;
        sendResponse({ ok: true, payload: data.payload });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  return false;
});
