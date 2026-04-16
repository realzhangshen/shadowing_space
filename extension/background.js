import { resolveImportEndpoint } from "./lib/endpoint.js";

const DELIVERY_MESSAGE_TYPE = "shadowing-space-extension/deliver";
const EXTRACTION_MESSAGE_TYPE = "shadowing-space-extension/extract";
const MAX_DELIVERY_ATTEMPTS = 30;
const DELIVERY_RETRY_MS = 500;
const NOTIFICATION_ICON_PATH = "icons/icon-128.png";

const BADGE_COLORS = {
  working: "#1f6feb",
  success: "#2ea043",
  error: "#d1242f",
};

function isYouTubeWatchUrl(url) {
  return typeof url === "string" && /^https:\/\/www\.youtube\.com\/watch\b/i.test(url);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readSettings() {
  try {
    return await chrome.storage.sync.get(["mode", "customUrl"]);
  } catch {
    return {};
  }
}

async function setBadge(tabId, state) {
  const config = {
    idle: { text: "", color: null },
    working: { text: "…", color: BADGE_COLORS.working },
    success: { text: "✓", color: BADGE_COLORS.success },
    error: { text: "!", color: BADGE_COLORS.error },
  }[state] ?? { text: "", color: null };

  try {
    if (typeof tabId === "number") {
      await chrome.action.setBadgeText({ tabId, text: config.text });
      if (config.color) {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: config.color });
      }
    } else {
      await chrome.action.setBadgeText({ text: config.text });
      if (config.color) {
        await chrome.action.setBadgeBackgroundColor({ color: config.color });
      }
    }
  } catch {
    // Ignore badge errors — they are cosmetic only.
  }
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
      title,
      message,
      priority: 1,
    });
  } catch (error) {
    console.error("Shadowing Space Importer notify failed:", error);
  }
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

async function runImport(tab) {
  if (!tab?.id) return;

  if (!isYouTubeWatchUrl(tab.url)) {
    await notify(
      "Open a YouTube video first",
      "Navigate to a YouTube watch page with captions, then click the Shadowing Space icon.",
    );
    return;
  }

  const tabId = tab.id;
  await setBadge(tabId, "working");

  try {
    const payload = await requestTranscriptPayload(tabId);

    const settings = await readSettings();
    const endpoint = resolveImportEndpoint(settings);
    const importTab = await chrome.tabs.create({ url: endpoint, active: true });

    if (!importTab.id) {
      throw new Error("Failed to open the Shadowing Space import page.");
    }

    await waitForTabComplete(importTab.id);
    await deliverPayload(importTab.id, payload);

    await setBadge(tabId, "success");
    setTimeout(() => {
      void setBadge(tabId, "idle");
    }, 4_000);
  } catch (error) {
    await setBadge(tabId, "error");
    const message = error instanceof Error ? error.message : String(error);
    console.error("Shadowing Space Importer:", error);
    await notify("Shadowing Space import failed", message);
    setTimeout(() => {
      void setBadge(tabId, "idle");
    }, 8_000);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void runImport(tab);
});

chrome.runtime.onInstalled.addListener(() => {
  console.info(
    "Shadowing Space Importer installed. Open the extension's Options page to point it at localhost or a self-hosted instance.",
  );
});
