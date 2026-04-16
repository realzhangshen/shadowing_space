import assert from "node:assert/strict";
import test from "node:test";
import { classifyTab, pickPopupView } from "../../extension/lib/popup-view.js";

test("classifyTab returns 'youtube-watch' for a watch URL", () => {
  assert.equal(classifyTab("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "youtube-watch");
  assert.equal(classifyTab("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"), "youtube-watch");
});

test("classifyTab returns 'youtube-other' for non-watch YouTube pages", () => {
  assert.equal(classifyTab("https://www.youtube.com/"), "youtube-other");
  assert.equal(classifyTab("https://www.youtube.com/results?search_query=foo"), "youtube-other");
  assert.equal(classifyTab("https://www.youtube.com/@somechannel"), "youtube-other");
  assert.equal(classifyTab("https://www.youtube.com/shorts/abc123"), "youtube-other");
  assert.equal(classifyTab("https://m.youtube.com/watch?v=abc"), "youtube-other");
});

test("classifyTab returns 'non-youtube' for unrelated URLs", () => {
  assert.equal(classifyTab("https://www.google.com/"), "non-youtube");
  assert.equal(classifyTab("https://shadowing.space/en/import"), "non-youtube");
  assert.equal(classifyTab("chrome://extensions/"), "non-youtube");
});

test("classifyTab returns 'non-youtube' for missing or malformed URLs", () => {
  assert.equal(classifyTab(undefined), "non-youtube");
  assert.equal(classifyTab(null), "non-youtube");
  assert.equal(classifyTab(""), "non-youtube");
  assert.equal(classifyTab("not a url"), "non-youtube");
});

test("pickPopupView returns 'welcome' for non-youtube tabs regardless of first-run flag", () => {
  assert.deepEqual(pickPopupView({ tabKind: "non-youtube", isFirstRun: false }), {
    view: "welcome",
    showIntroBanner: false,
  });
  assert.deepEqual(pickPopupView({ tabKind: "non-youtube", isFirstRun: true }), {
    view: "welcome",
    showIntroBanner: false,
  });
});

test("pickPopupView returns 'youtube-nudge' when on YouTube but not a watch page", () => {
  assert.deepEqual(pickPopupView({ tabKind: "youtube-other", isFirstRun: false }), {
    view: "youtube-nudge",
    showIntroBanner: false,
  });
  assert.deepEqual(pickPopupView({ tabKind: "youtube-other", isFirstRun: true }), {
    view: "youtube-nudge",
    showIntroBanner: false,
  });
});

test("pickPopupView returns 'ready' on a watch page and flags intro banner only on first run", () => {
  assert.deepEqual(pickPopupView({ tabKind: "youtube-watch", isFirstRun: false }), {
    view: "ready",
    showIntroBanner: false,
  });
  assert.deepEqual(pickPopupView({ tabKind: "youtube-watch", isFirstRun: true }), {
    view: "ready",
    showIntroBanner: true,
  });
});
