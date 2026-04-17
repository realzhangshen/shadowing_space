import assert from "node:assert/strict";
import test from "node:test";
import { GrowableFloat32Buffer } from "@/lib/growableFloat32Buffer";

test("push appends and snapshot length tracks writes", () => {
  const buf = new GrowableFloat32Buffer(4);
  buf.push(0.1);
  buf.push(0.2);
  const view = buf.snapshot();
  assert.equal(view.length, 2);
  assert.ok(Math.abs(view[0] - 0.1) < 1e-6);
  assert.ok(Math.abs(view[1] - 0.2) < 1e-6);
});

test("snapshot returns a view over the same underlying storage when no growth", () => {
  const buf = new GrowableFloat32Buffer(8);
  buf.push(1);
  const first = buf.snapshot();
  buf.push(2);
  const second = buf.snapshot();
  assert.equal(first.buffer, second.buffer);
  assert.equal(second.length, 2);
});

test("capacity grows geometrically on overflow and preserves existing values", () => {
  const buf = new GrowableFloat32Buffer(2);
  buf.push(0.25);
  buf.push(0.5);
  buf.push(0.75); // triggers growth
  const view = buf.snapshot();
  assert.equal(view.length, 3);
  assert.ok(Math.abs(view[0] - 0.25) < 1e-6);
  assert.ok(Math.abs(view[1] - 0.5) < 1e-6);
  assert.ok(Math.abs(view[2] - 0.75) < 1e-6);
});

test("reset zeros length without releasing capacity", () => {
  const buf = new GrowableFloat32Buffer(4);
  buf.push(1);
  buf.push(2);
  buf.reset();
  assert.equal(buf.snapshot().length, 0);
  assert.ok(buf.capacity >= 4);
  buf.push(9);
  assert.equal(buf.snapshot()[0], 9);
});

test("freeze returns an independent copy whose buffer is detached from storage", () => {
  const buf = new GrowableFloat32Buffer(4);
  buf.push(0.125);
  buf.push(0.375);
  const frozen = buf.freeze();
  assert.equal(frozen.length, 2);
  buf.push(0.5);
  assert.equal(frozen.length, 2);
  assert.notEqual(frozen.buffer, buf.snapshot().buffer);
});
