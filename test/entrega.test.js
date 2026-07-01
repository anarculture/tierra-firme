/* Gate de la bitácora Entrega (issue 03): liga → entregada; con foto → verificada
   (ADR 0005); bulk partible en varias Entregas (ADR 0004); foto interna no filtra. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, ingestNecesidad, ingestCompra, ingestEntrega, ligarEntrega, derivarEstado } from "../src/libro.js";
import { agregarInforme } from "../src/informe.js";

test("entrega sin foto → entregada; con foto-comprobante → verificada", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, { destino: { nombre: "Pérez", tipo: "hospital", zona: "CCS" }, insumo: "gasas" });
  ingestEntrega(l, { destino: "Pérez", quien_entrego: "Ana", necesidad_id: necesidad.id });
  assert.equal(derivarEstado(necesidad, l), "entregada", "entrega sin foto");
  ingestEntrega(l, { destino: "Pérez", quien_entrego: "Ana", necesidad_id: necesidad.id, foto: "comprobante.jpg" });
  assert.equal(derivarEstado(necesidad, l), "verificada", "entrega con foto");
});

test("ligarEntrega tras registrar deriva el estado", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, { destino: { nombre: "Vargas", tipo: "hospital" }, insumo: "agua" });
  const e = ingestEntrega(l, { destino: "Vargas", foto: "x.jpg" });
  assert.equal(derivarEstado(necesidad, l), "vigente", "entrega suelta no afecta hasta ligar");
  ligarEntrega(l, e.id, necesidad.id);
  assert.equal(derivarEstado(necesidad, l), "verificada");
});

test("bulk: 1 Compra → varias Entregas a distintos destinos (ADR 0004, sin inventario)", () => {
  const l = emptyLibro();
  const compra = ingestCompra(l, { items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }] });
  const n1 = ingestNecesidad(l, { destino: { nombre: "Pérez", tipo: "hospital" }, insumo: "gasas" }).necesidad;
  const n2 = ingestNecesidad(l, { destino: { nombre: "Vargas", tipo: "hospital" }, insumo: "gasas" }).necesidad;
  ingestEntrega(l, { destino: "Pérez", compra_id: compra.id, necesidad_id: n1.id, items: [{ insumo: "gasas", cantidad: 120 }] });
  ingestEntrega(l, { destino: "Vargas", compra_id: compra.id, necesidad_id: n2.id, items: [{ insumo: "gasas", cantidad: 80 }] });
  assert.equal(l.entregas.length, 2, "una compra se parte en dos entregas");
  assert.equal(l.entregas.filter((e) => e.compra_id === compra.id).length, 2);
  assert.equal(derivarEstado(n1, l), "entregada");
  assert.equal(derivarEstado(n2, l), "entregada");
});

test("foto-comprobante NO aparece en la salida pública (informe)", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, { destino: { nombre: "Pérez", tipo: "hospital" }, insumo: "gasas" });
  ingestCompra(l, { items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }], necesidad_id: necesidad.id });
  ingestEntrega(l, { destino: "Pérez", necesidad_id: necesidad.id, foto: "cara-paciente.jpg", quien_entrego: "Ana" });
  const json = JSON.stringify(agregarInforme(l));
  assert.ok(!json.includes("cara-paciente.jpg"), "la foto interna nunca sale al informe público");
  assert.ok(!json.includes("Ana"), "quién entregó tampoco");
});

test("ligarEntrega valida ids inexistentes", () => {
  const l = emptyLibro();
  const e = ingestEntrega(l, { destino: "x" });
  assert.throws(() => ligarEntrega(l, "no", e.id), /Entrega no encontrada/);
  assert.throws(() => ligarEntrega(l, e.id, "no"), /Necesidad no encontrada/);
});
