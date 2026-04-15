import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { AppError, toErrorResponse } from "@/server/errors";

const REQUEST_ID = "req-12345";

test("maps AppError to its statusCode and includes errorCode", async () => {
  const error = new AppError("Not allowed here", 403, "FORBIDDEN", { reason: "blocked" });
  const response = toErrorResponse(error, REQUEST_ID, {});

  assert.equal(response.status, 403);
  const body = (await response.json()) as {
    message: string;
    requestId: string;
    errorCode?: string;
    details?: Record<string, unknown>;
  };
  assert.equal(body.message, "Not allowed here");
  assert.equal(body.requestId, REQUEST_ID);
  assert.equal(body.errorCode, "FORBIDDEN");
  assert.deepEqual(body.details, { reason: "blocked" });
});

test("maps ZodError to 400 with fields details", async () => {
  const schema = z.object({ name: z.string().min(1) });
  let zodError: z.ZodError | null = null;
  try {
    schema.parse({ name: "" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      zodError = error;
    }
  }
  assert.ok(zodError, "expected zod to throw");

  const response = toErrorResponse(zodError, REQUEST_ID, {});
  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    message: string;
    details?: { fields?: Record<string, unknown> };
  };
  assert.equal(body.message, "Invalid request body");
  assert.ok(body.details?.fields);
  assert.ok("name" in (body.details.fields as Record<string, unknown>));
});

test("maps SyntaxError to 400", async () => {
  const error = new SyntaxError("Unexpected token");
  const response = toErrorResponse(error, REQUEST_ID, {});
  assert.equal(response.status, 400);
  const body = (await response.json()) as { message: string; requestId: string };
  assert.equal(body.message, "Malformed JSON in request body");
  assert.equal(body.requestId, REQUEST_ID);
});

test("maps unknown error to 500 with generic message", async () => {
  const error = new Error("boom");
  const response = toErrorResponse(error, REQUEST_ID, {});
  assert.equal(response.status, 500);
  const body = (await response.json()) as { message: string; requestId: string };
  assert.equal(body.message, "Internal server error");
  assert.equal(body.requestId, REQUEST_ID);
});

test("includes request id and rate limit headers in response", async () => {
  const error = new AppError("Boom", 502, "UPSTREAM_BAD");
  const headers = {
    "X-RateLimit-Limit": "10",
    "X-RateLimit-Remaining": "9",
    "X-RateLimit-Reset": "1700000000",
    "x-request-id": REQUEST_ID,
  };
  const response = toErrorResponse(error, REQUEST_ID, headers);

  assert.equal(response.headers.get("X-RateLimit-Limit"), "10");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "9");
  assert.equal(response.headers.get("X-RateLimit-Reset"), "1700000000");
  assert.equal(response.headers.get("x-request-id"), REQUEST_ID);
  const body = (await response.json()) as { requestId: string };
  assert.equal(body.requestId, REQUEST_ID);
});

test("sets Cache-Control no-store and x-request-id headers", () => {
  const error = new AppError("Boom", 500);
  const headers = {
    "Cache-Control": "no-store",
    "x-request-id": REQUEST_ID,
  };
  const response = toErrorResponse(error, REQUEST_ID, headers);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), REQUEST_ID);
});
