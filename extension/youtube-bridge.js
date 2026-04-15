const EXTRACTION_REQUEST_EVENT = "shadowing-space-extension:extract-request";
const EXTRACTION_RESULT_TYPE = "shadowing-space-extension/extract-result";
const EXTRACTION_TIMEOUT_MS = 20_000;

function waitForMainWorldPayload() {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Timed out while waiting for transcript extraction."));
    }, EXTRACTION_TIMEOUT_MS);

    const onMessage = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data;
      if (!data || data.type !== EXTRACTION_RESULT_TYPE) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);

      if (data.ok && data.payload) {
        resolve(data.payload);
        return;
      }

      reject(new Error(data.error || "Transcript extraction failed."));
    };

    window.addEventListener("message", onMessage);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "shadowing-space-extension/extract") {
    return false;
  }

  void (async () => {
    try {
      const pendingPayload = waitForMainWorldPayload();
      window.dispatchEvent(new CustomEvent(EXTRACTION_REQUEST_EVENT));
      const payload = await pendingPayload;
      sendResponse({
        ok: true,
        payload,
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
});
