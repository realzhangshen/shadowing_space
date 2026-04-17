import assert from "node:assert/strict";
import test from "node:test";
import { diffKeySets, flattenKeys } from "../../scripts/i18n/compareKeys";

test("flattenKeys produces dot-separated leaf paths", () => {
  const keys = flattenKeys({
    HomePage: { title: "Hi", subtitle: "There" },
    AppHeader: { nav: { home: "Home" } },
  });
  assert.deepEqual(
    [...keys].sort(),
    ["AppHeader.nav.home", "HomePage.subtitle", "HomePage.title"].sort(),
  );
});

test("flattenKeys records an empty object as a leaf so locale drift stays visible", () => {
  const keys = flattenKeys({ Empty: {} });
  assert.deepEqual([...keys], ["Empty"]);
});

test("diffKeySets reports keys missing from candidate and extras that do not exist in reference", () => {
  const reference = new Set(["a.b", "a.c", "d"]);
  const candidate = new Set(["a.b", "d", "e"]);
  const diff = diffKeySets(reference, candidate);
  assert.deepEqual(diff.missing, ["a.c"]);
  assert.deepEqual(diff.extra, ["e"]);
});

test("diffKeySets returns empty arrays when the two sets match", () => {
  const reference = new Set(["a", "b"]);
  const candidate = new Set(["b", "a"]);
  const diff = diffKeySets(reference, candidate);
  assert.deepEqual(diff.missing, []);
  assert.deepEqual(diff.extra, []);
});
