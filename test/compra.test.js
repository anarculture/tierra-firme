/* Gate de la bitácora Compra (issue 02): registro con costo_total, liga opcional que
   deriva `comprada` (ADR 0005), compra suelta sin liga. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, ingestNecesidad, ingestCompra, ligarCompra, derivarEstado, totalCompra } from "../src/libro.js";

test("texto de compra → Compra con items + costo_unitario + costo_total calculado", () => {
  const l = emptyLibro();
  const c = ingestCompra(l, { items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }], quien_compro: "equipo" });
  assert.equal(c.costo_total, 26000, "200 × 130");
  assert.equal(c.items[0].insumo, "gasas");
  assert.equal(l.compras.length, 1);
});

test("costo_total explícito gana; totalCompra suma varias líneas", () => {
  assert.equal(totalCompra([{ cantidad: 2, costo_unitario: 50 }, { cantidad: 3, costo_unitario: 10 }]), 130);
  const l = emptyLibro();
  const c = ingestCompra(l, { items: [{ insumo: "x", cantidad: 1, costo_unitario: 1 }], costo_total: 999 });
  assert.equal(c.costo_total, 999);
});

test("ligar Compra a Necesidad abierta → estado comprada (derivado, no tecleado)", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, { destino: { nombre: "Pérez", tipo: "hospital", zona: "CCS" }, insumo: "gasas" });
  assert.equal(derivarEstado(necesidad, l), "vigente");
  const c = ingestCompra(l, { items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }] });
  ligarCompra(l, c.id, necesidad.id);
  assert.equal(derivarEstado(necesidad, l), "comprada", "liga → comprada");
});

test("liga directa por necesidad_id en ingestCompra también deriva comprada", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, { destino: { nombre: "Vargas", tipo: "hospital" }, insumo: "agua" });
  ingestCompra(l, { items: [{ insumo: "agua", cantidad: 1, costo_unitario: 1 }], necesidad_id: necesidad.id });
  assert.equal(derivarEstado(necesidad, l), "comprada");
});

test("Compra sin Necesidad ligada es válida y persiste (así es el informe de hoy)", () => {
  const l = emptyLibro();
  const c = ingestCompra(l, { items: [{ insumo: "cemento", cantidad: 10, costo_unitario: 200 }] });
  assert.equal(c.necesidad_id, null);
  assert.equal(l.compras.length, 1);
  assert.equal(c.costo_total, 2000);
});

test("ligarCompra valida ids inexistentes", () => {
  const l = emptyLibro();
  const c = ingestCompra(l, { items: [{ insumo: "x", cantidad: 1, costo_unitario: 1 }] });
  assert.throws(() => ligarCompra(l, "no", c.id), /Compra no encontrada/);
  assert.throws(() => ligarCompra(l, c.id, "no"), /Necesidad no encontrada/);
});
