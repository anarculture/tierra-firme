/* M3 — gate failable: jitter determinista y acotado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jitter } from "../web/jitter.js";

test("jitter es determinista (mismo seed → mismo punto)", () => {
  assert.deepEqual(jitter(10, -66, "Centro A"), jitter(10, -66, "Centro A"));
});
test("seeds distintos → puntos distintos", () => {
  assert.notDeepEqual(jitter(10, -66, "Centro A"), jitter(10, -66, "Centro B"));
});
test("queda dentro del radio (~km)", () => {
  const km = 22;
  const r = jitter(10, -66, "X", km);
  assert.ok(Math.abs(r.lat - 10) <= km / 111 + 1e-6, "lat dentro de radio");
});
