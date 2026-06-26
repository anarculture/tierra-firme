/* C1 — gate failable: agregación de necesidades por tipo×estado, ordenada por urgencia. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { agregarNeeds, urgencyRank } from "../web/needs-board.js";

const centros = [
  { payload: { estado: "Falcón", needs: [{ key: "agua", level: "alta" }, { key: "comida", level: "media" }] } },
  { payload: { estado: "Falcón", needs: [{ key: "agua", level: "crítica" }] } },
  { payload: { estado: "Miranda", needs: [{ key: "agua", level: "baja" }] } }
];

test("urgencyRank ordena crítica>alta>media>baja", () => {
  assert.ok(urgencyRank("crítica") > urgencyRank("alta"));
  assert.ok(urgencyRank("alta") > urgencyRank("baja"));
});
test("agrega por tipo×estado y toma la urgencia máxima", () => {
  const r = agregarNeeds(centros);
  const aguaFalcon = r.find((x) => x.tipo === "agua" && x.estado === "Falcón");
  assert.equal(aguaFalcon.centros, 2);
  assert.equal(aguaFalcon.nivel, "crítica");
});
test("ordena por urgencia: primero la crítica", () => {
  assert.equal(agregarNeeds(centros)[0].nivel, "crítica");
});
