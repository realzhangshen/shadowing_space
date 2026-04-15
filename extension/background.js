const DEFAULT_IMPORT_URL = "https://shadowing.space/en/import?source=extension";
const LOCAL_IMPORT_URL = "http://localhost:3000/en/import?source=extension";
const DELIVERY_MESSAGE_TYPE = "shadowing-space-extension/deliver";
const EXTRACTION_MESSAGE_TYPE = "shadowing-space-extension/extract";
const MAX_DELIVERY_ATTEMPTS = 20;
const DELIVERY_RETRY_MS = 500;

function isYouTubeWatchUrl(url) {
  return typeof url === "string" && /^https:\/\/www\.youtube\.com\/watch\b/i.test(url);
}

function chooseImportUrl() {
  return DEFAULT_IMPORT_URL;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function requestTranscriptPayload(tabId) {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: EXTRACTION_MESSAGE_TYPE,
  });

  if (!response?.ok || !response.payload) {
    throw new Error(response?.error || "Failed to extract transcript from YouTube.");
  }

  return response.payload;
}

async function deliverPayload(tabId, payload) {
  let lastErrorMessage = "Import page did not acknowledge extension payload.";

  for (let attempt = 0; attempt < MAX_DELIVERY_ATTEMPTS; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: DELIVERY_MESSAGE_TYPE,
        payload,
      });

      if (response?.ok) {
        return;
      }

      lastErrorMessage = response?.error || lastErrorMessage;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error);
    }

    await sleep(DELIVERY_RETRY_MS);
  }

  throw new Error(lastErrorMessage);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isYouTubeWatchUrl(tab.url)) {
    console.warn("Shadowing Space Importer: open a YouTube watch page first.");
    return;
  }

  try {
    const payload = await requestTranscriptPayload(tab.id);
    const importTab = await chrome.tabs.create({
      url: chooseImportUrl(),
      active: true,
    });

    if (!importTab.id) {
      throw new Error("Failed to open the Shadowing Space import page.");
    }

    await waitForTabComplete(importTab.id);
    await deliverPayload(importTab.id, payload);
  } catch (error) {
    console.error("Shadowing Space Importer:", error);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.info(
    "Shadowing Space Importer installed. Change LOCAL_IMPORT_URL in extension/background.js if you want to test against localhost.",
  );
});

void LOCAL_IMPORT_URL;
