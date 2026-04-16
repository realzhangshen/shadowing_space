// Background service worker.
//
// In the new popup-first flow the popup does all the heavy lifting (tab query,
// content-script messaging, tab delivery, downloads). This service worker is
// kept minimal because MV3 still requires it to register content scripts and
// to bootstrap first-install hints.

chrome.runtime.onInstalled.addListener(() => {
  console.info(
    "[SS] Shadowing Space Importer installed. Click the toolbar icon on a YouTube watch page to open the popup.",
  );
});
