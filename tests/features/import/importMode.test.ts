import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveImportMode,
  EXTENSION_HANDOFF_TIMEOUT_MS,
  reduceExtensionHandoff,
  type ExtensionHandoffState,
} from "@/features/import/importMode";

test("deriveImportMode returns 'manual' when source is absent", () => {
  assert.equal(deriveImportMode({ searchParams: new URLSearchParams() }), "manual");
  assert.equal(deriveImportMode({ searchParams: new URLSearchParams("?foo=bar") }), "manual");
});

test("deriveImportMode returns 'extension' when source=extension is present", () => {
  assert.equal(
    deriveImportMode({ searchParams: new URLSearchParams("?source=extension") }),
    "extension",
  );
});

test("deriveImportMode ignores source values other than 'extension'", () => {
  assert.equal(deriveImportMode({ searchParams: new URLSearchParams("?source=other") }), "manual");
});

test("reduceExtensionHandoff starts in 'awaiting' and transitions on payload_received", () => {
  const initial: ExtensionHandoffState = { kind: "awaiting", startedAt: 1_000 };

  const next = reduceExtensionHandoff(initial, {
    type: "payload_received",
    at: 1_500,
  });

  assert.equal(next.kind, "processing");
  if (next.kind === "processing") {
    assert.equal(next.receivedAt, 1_500);
  }
});

test("reduceExtensionHandoff transitions to 'timeout' after the grace period elapses", () => {
  const initial: ExtensionHandoffState = { kind: "awaiting", startedAt: 1_000 };
  const tickBefore = reduceExtensionHandoff(initial, {
    type: "tick",
    now: 1_000 + EXTENSION_HANDOFF_TIMEOUT_MS - 1,
  });
  assert.equal(tickBefore.kind, "awaiting");

  const tickAfter = reduceExtensionHandoff(initial, {
    type: "tick",
    now: 1_000 + EXTENSION_HANDOFF_TIMEOUT_MS,
  });
  assert.equal(tickAfter.kind, "timed_out");
});

test("reduceExtensionHandoff ignores tick once payload was received", () => {
  const state: ExtensionHandoffState = {
    kind: "processing",
    receivedAt: 1_500,
  };

  const next = reduceExtensionHandoff(state, {
    type: "tick",
    now: 999_999,
  });

  assert.equal(next, state);
});

test("reduceExtensionHandoff transitions from processing to error on failure", () => {
  const state: ExtensionHandoffState = { kind: "processing", receivedAt: 1_500 };
  const next = reduceExtensionHandoff(state, {
    type: "failed",
    message: "Bundle rejected",
  });

  assert.equal(next.kind, "error");
  if (next.kind === "error") {
    assert.equal(next.message, "Bundle rejected");
  }
});

test("reduceExtensionHandoff recovers from timeout back to awaiting on payload_received", () => {
  const state: ExtensionHandoffState = { kind: "timed_out", startedAt: 1_000 };
  const next = reduceExtensionHandoff(state, {
    type: "payload_received",
    at: 99_000,
  });

  assert.equal(next.kind, "processing");
});
