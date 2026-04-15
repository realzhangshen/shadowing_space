import assert from "node:assert/strict";
import test from "node:test";
import { cleanVocabularyText, normalizeVocabularyKey } from "@/features/vocabulary/words";

test("cleanVocabularyText trims surrounding punctuation and spaces", () => {
  assert.equal(cleanVocabularyText("  “hesitate!”  "), "hesitate");
});

test("cleanVocabularyText preserves inner punctuation and collapses whitespace", () => {
  assert.equal(cleanVocabularyText("  don't    give   up  "), "don't give up");
});

test("normalizeVocabularyKey lowercases and normalizes cleaned text", () => {
  assert.equal(normalizeVocabularyKey("  Café  "), "café");
});
