/* Gate de clasificación + desambiguación (issue 07): ruteo de las 5 categorías y la
   lógica mismo/más (ADR 0007). Engine puro, sin red. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, ingestNecesidad, derivarEstado, setEstadoManual } from "../src/libro.js";
import { rutear, resolverDesambiguacion, preguntaDesambiguacion, CATEGORIAS } from "../src/clasifica.js";

const dest = { nombre: "Pérez", tipo: "hospital", zona: "Caracas" };

test("ruteo de las 5 categorías", () => {
  assert.deepEqual(CATEGORIAS, ["necesidad_nueva", "actualizacion", "compra", "entrega", "ruido"]);
  const l = emptyLibro();
  assert.equal(rutear(l, { categoria: "ruido" }).accion, "ignorar");
  assert.equal(rutear(l, { categoria: "necesidad_nueva", destino: dest, insumo: "gasas" }).accion, "necesidad_creada");
  assert.equal(l.necesidades.length, 1);
  assert.equal(rutear(l, { categoria: "compra", items: [{ insumo: "gasas", cantidad: 200, costo_unitario: 130 }] }).accion, "compra_creada");
  assert.equal(l.compras.length, 1);
  assert.equal(rutear(l, { categoria: "entrega", destino: "Pérez", items: [{ insumo: "gasas", cantidad: 200 }] }).accion, "entrega_creada");
  assert.equal(l.entregas.length, 1);
  assert.equal(rutear(l, { categoria: "actualizacion", destino: dest, insumo: "gasas" }).accion, "actualizacion");
});

test("ruido no muta el libro", () => {
  const l = emptyLibro();
  rutear(l, { categoria: "ruido" });
  assert.equal(l.necesidades.length + l.compras.length + l.entregas.length, 0);
});

test("necesidad repetida con instancia abierta → desambiguar (NO auto-dedup)", () => {
  const l = emptyLibro();
  rutear(l, { categoria: "necesidad_nueva", destino: dest, insumo: "gasas" });
  const r = rutear(l, { categoria: "necesidad_nueva", destino: dest, insumo: "gasas", cantidad: 100 });
  assert.equal(r.accion, "desambiguar", "pregunta al reportante, no dedup silencioso");
  assert.match(r.pregunta, /lo mismo o se necesitan más/i);
  assert.equal(l.necesidades.length, 1, "no se creó ni incrementó nada hasta la respuesta");
  assert.equal(l.necesidades[0].reportes, 1);
});

test('"lo mismo" → reportes++; "más" → sube cantidad', () => {
  const l = emptyLibro();
  const nec = ingestNecesidad(l, { destino: dest, insumo: "gasas", cantidad: 100 }).necesidad;
  resolverDesambiguacion(l, nec.id, "es lo mismo", { cantidad: 50 });
  assert.equal(nec.reportes, 2, "mismo → reportes++");
  assert.equal(nec.cantidad, 100, "mismo → cantidad intacta");
  resolverDesambiguacion(l, nec.id, "no, se necesitan más", { cantidad: 50 });
  assert.equal(nec.cantidad, 150, "más → sube cantidad 100+50");
});

test("necesidad resuelta libera cupo → mención posterior crea instancia nueva (no pregunta)", () => {
  const l = emptyLibro();
  const nec = ingestNecesidad(l, { destino: dest, insumo: "gasas" }).necesidad;
  setEstadoManual(l, nec.id, "cancelada"); // resuelta
  const r = rutear(l, { categoria: "necesidad_nueva", destino: dest, insumo: "gasas" });
  assert.equal(r.accion, "necesidad_creada", "sin instancia abierta → nueva, sin desambiguar");
  assert.equal(l.necesidades.length, 2);
});

test("preguntaDesambiguacion nombra destino + insumo", () => {
  const nec = { destino: { nombre: "Hospital Vargas" }, insumo: "agua" };
  const q = preguntaDesambiguacion(nec);
  assert.ok(q.includes("Hospital Vargas") && q.includes("agua"));
});
