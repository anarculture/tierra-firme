/* Gate del Informe de compras (issue 04): agregación (suma de costos, conteo de
   tipos/unidades) + no-fuga de PII (nombres de voluntarios / prueba interna). */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, ingestCompra } from "../src/libro.js";
import { agregarInforme } from "../src/informe.js";

function libroConCompras() {
  const l = emptyLibro("POLIRITMO");
  ingestCompra(l, { items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }], quien_compro: "Ana", factura: "f1.jpg" });
  ingestCompra(l, { items: [{ insumo: "gasas", cantidad: 100, costo_unitario: 130 }], quien_compro: "Luis" }); // misma línea → funde
  ingestCompra(l, { items: [{ insumo: "agua", cantidad: 50, costo_unitario: 20 }, { insumo: "guantes", cantidad: 10, costo_unitario: 5 }], quien_compro: "Ana" });
  return l;
}

test("agrega: funde líneas iguales, numera, calcula costo_total", () => {
  const inf = agregarInforme(libroConCompras(), { fecha: "2026-06-26" });
  const gasas = inf.lineas.find((l) => l.descripcion === "gasas");
  assert.equal(gasas.cantidad, 300, "200+100 gasas @130 se funden");
  assert.equal(gasas.costo_total, 39000, "300 × 130");
  assert.deepEqual(inf.lineas.map((l) => l.n), [1, 2, 3], "numeradas 1..N");
});

test("resumen: tipos, unidades, total invertido", () => {
  const inf = agregarInforme(libroConCompras());
  assert.equal(inf.resumen.tipos, 3, "gasas, agua, guantes");
  assert.equal(inf.resumen.unidades, 360, "300 + 50 + 10");
  assert.equal(inf.resumen.total_invertido, 39000 + 1000 + 50, "sumatoria de costo_total");
});

test("no-fuga PII: ningún nombre de voluntario ni prueba interna en la salida", () => {
  const inf = agregarInforme(libroConCompras());
  const json = JSON.stringify(inf);
  assert.ok(!json.includes("Ana") && !json.includes("Luis"), "nombres de voluntarios NO");
  assert.ok(!json.includes("f1.jpg") && !json.toLowerCase().includes("factura"), "factura interna NO");
  assert.ok(!json.includes("quien_compro") && !json.includes("necesidad_id"), "campos internos NO");
});

test("libro sin compras → informe vacío coherente", () => {
  const inf = agregarInforme(emptyLibro());
  assert.deepEqual(inf.lineas, []);
  assert.deepEqual(inf.resumen, { tipos: 0, unidades: 0, total_invertido: 0 });
});
