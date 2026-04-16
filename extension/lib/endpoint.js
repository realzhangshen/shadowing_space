// Pure helpers for resolving the Shadowing Space import endpoint.
// Kept dependency-free so it can run in both the extension service worker
// and Node (for unit tests).

export const DEFAULT_IMPORT_ENDPOINT = "https://shadowing.space/en/import?source=extension";
export const LOCAL_IMPORT_ENDPOINT = "http://localhost:3000/en/import?source=extension";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeImportEndpoint(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function withSourceExtension(rawUrl) {
  const normalized = normalizeImportEndpoint(rawUrl);
  if (!normalized) return null;

  const parsed = new URL(normalized);
  if (parsed.searchParams.get("source") !== "extension") {
    parsed.searchParams.set("source", "extension");
  }
  return parsed.toString();
}

export function resolveImportEndpoint(settings) {
  if (!settings || typeof settings !== "object") {
    return DEFAULT_IMPORT_ENDPOINT;
  }

  if (settings.mode === "localhost") {
    return LOCAL_IMPORT_ENDPOINT;
  }

  if (settings.mode === "custom") {
    const resolved = withSourceExtension(settings.customUrl);
    if (resolved) return resolved;
    return DEFAULT_IMPORT_ENDPOINT;
  }

  return DEFAULT_IMPORT_ENDPOINT;
}
