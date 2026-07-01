/* Gate de Foto→OCR→libro (issue 09): mappers puros con salida VLM mockeada.
   foto-lista → Necesidad con items reales; foto-factura → Compra con costos + adjunto. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, derivarEstado, ingestNecesidad } from "../src/libro.js";
import { vlmANecesidades, vlmACompra, ingestaFotoNecesidades, ingestaFotoFactura } from "../src/foto-libro.js";

// forma que devuelve extractList(): items[{fields:{campo:{value,confidence}}}], relevant, ...
const cell = (v) => ({ value: v, confidence: 0.9 });
const vlmLista = {
  relevant: true, confidence: 0.9,
  items: [
    { fields: { articulo: cell("gasas estériles"), cantidad: cell(47), unidad: cell("unidades"), notas: cell("") }, confidence: 0.9 },
    { fields: { articulo: cell("apósitos"), cantidad: cell(null), unidad: cell(null), notas: cell("") }, confidence: 0.8 },
    { fields: { articulo: cell(null), cantidad: cell(null) }, confidence: 0.2 }, // sin artículo → se salta
  ],
};
const vlmFactura = {
  relevant: true, confidence: 0.95,
  items: [
    { fields: { articulo: cell("gasas"), cantidad: cell(200), costo_unitario: cell(130) }, confidence: 0.95 },
    { fields: { articulo: cell("guantes"), cantidad: cell(10), costo_unitario: cell(5) }, confidence: 0.9 },
  ],
};

test("foto de lista → menciones de Necesidad (sin placeholder; salta ítems sin artículo)", () => {
  const menciones = vlmANecesidades(vlmLista, { nombre: "Punto Catia", tipo: "punto_apoyo", zona: "Caracas" });
  assert.equal(menciones.length, 2, "2 ítems válidos, el sin-artículo se descarta");
  assert.equal(menciones[0].insumo, "gasas estériles");
  assert.equal(menciones[0].cantidad, 47);
});

test("foto de lista → Necesidades reales en el libro (cierra 'no especificada')", () => {
  const l = emptyLibro();
  const menciones = vlmANecesidades(vlmLista, { nombre: "Punto Catia", tipo: "punto_apoyo", zona: "Caracas" });
  const necs = ingestaFotoNecesidades(l, menciones);
  assert.equal(necs.length, 2);
  assert.equal(l.necesidades.length, 2);
  assert.ok(l.necesidades.every((n) => n.insumo && !/no especificad/i.test(n.insumo)));
});

test("foto de factura → Compra con líneas + costos + adjunto guardado", () => {
  const compra = vlmACompra(vlmFactura, { factura: "cleaner/facturas/f1.jpg", quien_compro: "equipo" });
  assert.equal(compra.items.length, 2);
  assert.deepEqual(compra.items[0], { insumo: "gasas", cantidad: 200, costo_unitario: 130 });
  assert.equal(compra.factura, "cleaner/facturas/f1.jpg", "adjunto de factura guardado (interno)");
});

test("foto-factura → Compra en el libro con costo_total calculado; puede ligar → comprada", () => {
  const l = emptyLibro();
  const nec = ingestNecesidad(l, { destino: { nombre: "Pérez", tipo: "hospital", zona: "CCS" }, insumo: "gasas" }).necesidad;
  const compra = vlmACompra(vlmFactura, { factura: "f.jpg", necesidad_id: nec.id });
  const c = ingestaFotoFactura(l, compra);
  assert.equal(c.costo_total, 200 * 130 + 10 * 5, "26050");
  assert.equal(derivarEstado(nec, l), "comprada", "factura ligada deriva comprada");
});

test("VLM no relevante → cero menciones (no auto-ingesta comprobantes/PII)", () => {
  assert.deepEqual(vlmANecesidades({ relevant: false, items: [{ fields: { articulo: cell("x") } }] }, {}), []);
});
