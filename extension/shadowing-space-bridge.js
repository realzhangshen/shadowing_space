chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "shadowing-space-extension/deliver" || !message.payload) {
    return false;
  }

  window.postMessage(
    {
      type: "shadowing-space-extension/import",
      payload: message.payload,
    },
    window.location.origin,
  );

  sendResponse({ ok: true });
  return false;
});
