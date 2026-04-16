import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IMPORT_ENDPOINT,
  LOCAL_IMPORT_ENDPOINT,
  normalizeImportEndpoint,
  resolveImportEndpoint,
} from "../../extension/lib/endpoint.js";

test("resolveImportEndpoint returns the production URL when settings are empty", () => {
  assert.equal(resolveImportEndpoint({}), DEFAULT_IMPORT_ENDPOINT);
  assert.equal(resolveImportEndpoint({ mode: undefined }), DEFAULT_IMPORT_ENDPOINT);
});

test("resolveImportEndpoint returns the localhost URL when mode is localhost", () => {
  assert.equal(resolveImportEndpoint({ mode: "localhost" }), LOCAL_IMPORT_ENDPOINT);
});

test("resolveImportEndpoint returns the custom URL when mode is custom and URL is valid", () => {
  const result = resolveImportEndpoint({
    mode: "custom",
    customUrl: "https://my-self-host.example.com/en/import",
  });
  assert.equal(result, "https://my-self-host.example.com/en/import?source=extension");
});

test("resolveImportEndpoint preserves ?source=extension if already present in custom URL", () => {
  const result = resolveImportEndpoint({
    mode: "custom",
    customUrl: "https://my-self-host.example.com/en/import?source=extension",
  });
  assert.equal(result, "https://my-self-host.example.com/en/import?source=extension");
});

test("resolveImportEndpoint preserves existing query params and appends source=extension", () => {
  const result = resolveImportEndpoint({
    mode: "custom",
    customUrl: "https://my-self-host.example.com/zh-Hans/import?foo=bar",
  });
  assert.equal(result, "https://my-self-host.example.com/zh-Hans/import?foo=bar&source=extension");
});

test("resolveImportEndpoint falls back to default when custom URL is missing or invalid", () => {
  assert.equal(resolveImportEndpoint({ mode: "custom", customUrl: "" }), DEFAULT_IMPORT_ENDPOINT);
  assert.equal(
    resolveImportEndpoint({ mode: "custom", customUrl: "not-a-url" }),
    DEFAULT_IMPORT_ENDPOINT,
  );
  assert.equal(
    resolveImportEndpoint({ mode: "custom", customUrl: "ftp://disallowed.example.com/" }),
    DEFAULT_IMPORT_ENDPOINT,
  );
});

test("normalizeImportEndpoint trims whitespace and rejects non-http(s) URLs", () => {
  assert.equal(
    normalizeImportEndpoint("  https://example.com/en/import  "),
    "https://example.com/en/import",
  );
  assert.equal(
    normalizeImportEndpoint("http://localhost:3000/en/import"),
    "http://localhost:3000/en/import",
  );
  assert.equal(normalizeImportEndpoint("javascript:alert(1)"), null);
  assert.equal(normalizeImportEndpoint(""), null);
  assert.equal(normalizeImportEndpoint("   "), null);
});
