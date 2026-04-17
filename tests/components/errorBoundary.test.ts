import assert from "node:assert/strict";
import test from "node:test";
import { ErrorBoundary } from "@/components/ErrorBoundary";

test("ErrorBoundary.getDerivedStateFromError stores the thrown error in state", () => {
  const err = new Error("boom");
  const next = ErrorBoundary.getDerivedStateFromError(err);
  assert.equal(next.error, err);
});

test("ErrorBoundary.getDerivedStateFromError returns a fresh state object each call", () => {
  const a = ErrorBoundary.getDerivedStateFromError(new Error("a"));
  const b = ErrorBoundary.getDerivedStateFromError(new Error("b"));
  assert.notEqual(a, b);
  assert.notEqual(a.error, b.error);
});
