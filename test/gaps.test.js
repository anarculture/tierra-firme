/* A3 — gate failable: agregación de necesidad/cobertura por estado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsPorEstado } from "../web/gaps.js";

const centros = [
  { payload: { estado: "Falcón", needs: [{ key: "agua" }, { key: "comida" }] } },
  { payload: { estado: "La Guaira (Vargas)", needs: [{ key: "agua" }] } },
  { payload: { estado: "Falcón", needs: [] } },
  { payload: { estado: "", needs: [{ key: "x" }] } }
];

test("agrega needs y centros por estado", () => {
  const a = needsPorEstado(centros);
  assert.deepEqual(a["Falcón"], { needs: 2, centros: 2 });
});
test("normaliza nombre de estado (paréntesis)", () => {
  assert.deepEqual(needsPorEstado(centros)["La Guaira"], { needs: 1, centros: 1 });
});
test("ignora centros sin estado", () => {
  assert.equal(needsPorEstado(centros)[""], undefined);
});
