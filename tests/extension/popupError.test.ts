import assert from "node:assert/strict";
import test from "node:test";
import { mapPopupError } from "../../extension/lib/popup-error.js";

test("mapPopupError maps content-script-unreachable errors to a friendly refresh prompt", () => {
  const result = mapPopupError(
    new Error(
      "Can't reach the YouTube tab (Could not establish connection). Please refresh the page and try again.",
    ),
  );
  assert.equal(result.kind, "content-script-unreachable");
  assert.match(result.title, /reach|refresh/i);
  assert.ok(result.body && result.body.length > 0);
  assert.deepEqual(result.action, { kind: "refresh-tab", label: "Refresh YouTube tab" });
});

test("mapPopupError also matches the legacy 'Content script unreachable' message shape", () => {
  const result = mapPopupError("Content script unreachable (timeout).");
  assert.equal(result.kind, "content-script-unreachable");
  assert.deepEqual(result.action, { kind: "refresh-tab", label: "Refresh YouTube tab" });
});

test("mapPopupError tells the user to pick a track when none is selected", () => {
  const result = mapPopupError(new Error("No track selected."));
  assert.equal(result.kind, "no-track-selected");
  assert.equal(result.action, null);
  assert.match(result.title, /track/i);
});

test("mapPopupError explains extraction failures and suggests a retry", () => {
  const result = mapPopupError(new Error("Could not read caption tracks."));
  assert.equal(result.kind, "extraction-failed");
  assert.deepEqual(result.action, { kind: "refresh-tab", label: "Refresh YouTube tab" });
});

test("mapPopupError maps Chrome permission denials to a helpful open-options prompt", () => {
  const result = mapPopupError(new Error("Permission denied for that origin."));
  assert.equal(result.kind, "permission-denied");
  assert.deepEqual(result.action, { kind: "open-options", label: "Open Options" });
});

test("mapPopupError falls back to a generic unknown-error entry for unexpected messages", () => {
  const result = mapPopupError(new Error("something totally unexpected"));
  assert.equal(result.kind, "unknown");
  assert.match(result.title, /wrong|error/i);
  assert.equal(result.action, null);
  assert.match(result.body, /something totally unexpected/);
});

test("mapPopupError tolerates string or null input", () => {
  const stringResult = mapPopupError("No track selected.");
  assert.equal(stringResult.kind, "no-track-selected");

  const nullResult = mapPopupError(null);
  assert.equal(nullResult.kind, "unknown");
  assert.ok(nullResult.body && nullResult.body.length > 0);

  const undefinedResult = mapPopupError(undefined);
  assert.equal(undefinedResult.kind, "unknown");
});
