/* Gate del modelo de dominio base (issue 01). Cubre los dos invariantes que si
   se rompen, rompen todo lo de arriba: identidad open-instance (ADR 0007) y
   estado derivado de eventos (ADR 0005). Sin red, determinista. */
import { test } from "node:test";
import assert from "node:assert";
import {
  emptyLibro, ingestNecesidad, derivarEstado, setEstadoManual, vistaNecesidades, openKey,
} from "../src/libro.js";

const mencion = (nombre, insumo, extra = {}) => ({ destino: { nombre, tipo: "hospital", zona: "Caracas" }, insumo, ...extra });

test("id estable derivado de destino+insumo (mismo destino+insumo → misma clave)", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, mencion("Hospital Pérez Carreño", "gasas"));
  assert.equal(necesidad.id, `${openKey("Hospital Pérez Carreño", "gasas")}#1`);
  // variantes de escritura colapsan a la misma clave (normalización)
  assert.equal(openKey("hospital perez carreno", "Gasas"), openKey("Hospital Pérez Carreño", "gasas"));
});

test("5 menciones del mismo destino+insumo con instancia abierta → 1 Necesidad reportes=5", () => {
  const l = emptyLibro();
  for (let i = 0; i < 5; i++) ingestNecesidad(l, mencion("Pérez Carreño", "gasas"));
  assert.equal(l.necesidades.length, 1, "dedup anti-ruido: una sola instancia");
  assert.equal(l.necesidades[0].reportes, 5);
});

test("resolver (cancelada) libera el cupo → mención posterior abre instancia nueva", () => {
  const l = emptyLibro();
  const { necesidad: n1 } = ingestNecesidad(l, mencion("Pérez", "gasas"));
  setEstadoManual(l, n1.id, "cancelada"); // resuelve
  const r = ingestNecesidad(l, mencion("Pérez", "gasas"));
  assert.equal(r.accion, "nueva", "cupo liberado → instancia fresca");
  assert.equal(l.necesidades.length, 2);
  assert.equal(r.necesidad.id, `${openKey("Pérez", "gasas")}#2`, "id de instancia nueva incrementa");
});

test("por_decidir NO libera el cupo (sigue ocupando el slug)", () => {
  const l = emptyLibro();
  const { necesidad: n1 } = ingestNecesidad(l, mencion("Pérez", "gasas"));
  setEstadoManual(l, n1.id, "por_decidir");
  const r = ingestNecesidad(l, mencion("Pérez", "gasas"));
  assert.equal(r.accion, "dedup", "por_decidir no resuelve → mención cae en la misma instancia");
  assert.equal(l.necesidades.length, 1);
});

test("estado derivado: vigente → comprada → entregada → verificada (ADR 0005)", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, mencion("Pérez", "gasas"));
  const id = necesidad.id;
  assert.equal(derivarEstado(necesidad, l), "vigente", "sin eventos ligados");

  l.compras.push({ id: "c1", necesidad_id: id, items: [], costo_total: 0 });
  assert.equal(derivarEstado(necesidad, l), "comprada", "compra ligada");

  l.entregas.push({ id: "e1", necesidad_id: id });
  assert.equal(derivarEstado(necesidad, l), "entregada", "entrega sin foto");

  l.entregas.push({ id: "e2", necesidad_id: id, foto: "comprobante.jpg" });
  assert.equal(derivarEstado(necesidad, l), "verificada", "entrega con foto-comprobante");
});

test("manual gana sobre derivado; setEstadoManual valida el enum", () => {
  const l = emptyLibro();
  const { necesidad } = ingestNecesidad(l, mencion("Pérez", "gasas"));
  l.compras.push({ id: "c1", necesidad_id: necesidad.id });
  assert.equal(derivarEstado(necesidad, l), "comprada");
  setEstadoManual(l, necesidad.id, "cancelada");
  assert.equal(derivarEstado(necesidad, l), "cancelada", "manual override");
  assert.throws(() => setEstadoManual(l, necesidad.id, "vigente"), /inválido/, "vigente no es manual");
  assert.throws(() => setEstadoManual(l, "no-existe", "cancelada"), /no encontrada/);
});

test("vistaNecesidades adjunta el estado derivado para el panel", () => {
  const l = emptyLibro();
  ingestNecesidad(l, mencion("Pérez", "gasas"));
  ingestNecesidad(l, mencion("Vargas", "agua"));
  l.compras.push({ id: "c1", necesidad_id: l.necesidades[0].id });
  const v = vistaNecesidades(l);
  assert.equal(v.length, 2);
  assert.equal(v.find((n) => n.insumo === "gasas").estado, "comprada");
  assert.equal(v.find((n) => n.insumo === "agua").estado, "vigente");
});
