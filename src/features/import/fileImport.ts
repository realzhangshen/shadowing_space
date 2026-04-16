import {
  parseExtensionImportMessage,
  type ExtensionImportPayload,
} from "@/features/import/extensionImport";

/**
 * Parses a JSON file (produced by the Shadowing Space browser extension's
 * "Download JSON" action) into an ExtensionImportPayload. Strips BOM + leading
 * whitespace so copy-pasted or OS-annotated files still parse.
 */
export function parseExtensionPayloadFromText(text: string): ExtensionImportPayload {
  const trimmed = text.replace(/^\uFEFF/, "").trimStart();

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `Could not parse JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // The extension payload is nested inside a "message"-shaped envelope when
  // delivered via postMessage. The standalone downloaded file is the payload
  // directly — so we try both.
  const messageShape = parseExtensionImportMessage(raw);
  if (messageShape) return messageShape;

  const envelope = parseExtensionImportMessage({
    type: "shadowing-space-extension/import",
    payload: raw,
  });
  if (envelope) return envelope;

  throw new Error(
    "This does not look like a Shadowing Space transcript file. Expected a JSON payload exported from the browser extension.",
  );
}
