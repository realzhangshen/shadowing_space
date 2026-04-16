// State helpers for the extension-driven import flow.
// Kept as pure functions so the UI layer can stay thin and tested separately.

export const EXTENSION_HANDOFF_TIMEOUT_MS = 4_000;

export type ImportMode = "manual" | "extension";

export type ExtensionHandoffState =
  | { kind: "awaiting"; startedAt: number }
  | { kind: "processing"; receivedAt: number }
  | { kind: "timed_out"; startedAt: number }
  | { kind: "error"; message: string };

export type ExtensionHandoffAction =
  | { type: "tick"; now: number }
  | { type: "payload_received"; at: number }
  | { type: "failed"; message: string };

export function deriveImportMode(input: { searchParams: URLSearchParams }): ImportMode {
  const source = input.searchParams.get("source");
  return source === "extension" ? "extension" : "manual";
}

export function reduceExtensionHandoff(
  state: ExtensionHandoffState,
  action: ExtensionHandoffAction,
): ExtensionHandoffState {
  switch (action.type) {
    case "tick": {
      if (state.kind !== "awaiting") {
        return state;
      }
      if (action.now - state.startedAt >= EXTENSION_HANDOFF_TIMEOUT_MS) {
        return { kind: "timed_out", startedAt: state.startedAt };
      }
      return state;
    }
    case "payload_received": {
      return { kind: "processing", receivedAt: action.at };
    }
    case "failed": {
      return { kind: "error", message: action.message };
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
