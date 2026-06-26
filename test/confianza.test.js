/* B3 — gate failable: mapeo fuente → confianza. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { confianza } from "../web/confianza.js";

test("fuente oficial (usgs) → oficial, sin razón", () => {
  const c = confianza("usgs");
  assert.equal(c.nivel, "oficial");
  assert.equal(c.razon, undefined);
});
test("fuente comunitaria (ayudave) → comunitario con razón", () => {
  const c = confianza("ayudave");
  assert.equal(c.nivel, "comunitario");
  assert.ok(c.razon && c.razon.length > 0);
});
test("curado → curado", () => {
  assert.equal(confianza("curado").nivel, "curado");
});
