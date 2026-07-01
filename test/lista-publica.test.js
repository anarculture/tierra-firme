/* Gate de la lista pública recortada (issue 05): solo `vigente`, solo zona+insumo+urgencia,
   cero PII / cero detalle interno. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, ingestNecesidad, ingestCompra, setEstadoManual } from "../src/libro.js";
import { listaPublica } from "../src/lista-publica.js";

function libroMixto() {
  const l = emptyLibro();
  const vig = ingestNecesidad(l, { destino: { nombre: "Hospital Pérez Carreño", tipo: "hospital", zona: "Caracas" }, insumo: "gasas", urgencia: "alta" }).necesidad;
  const compr = ingestNecesidad(l, { destino: { nombre: "Hospital Vargas", tipo: "hospital", zona: "La Guaira" }, insumo: "agua", urgencia: "media" }).necesidad;
  const canc = ingestNecesidad(l, { destino: { nombre: "Dr. Massieu", tipo: "doctor", zona: "Caracas" }, insumo: "insulina", urgencia: "alta" }).necesidad;
  ingestCompra(l, { items: [{ insumo: "agua", cantidad: 1, costo_unitario: 1 }], necesidad_id: compr.id }); // → comprada
  setEstadoManual(l, canc.id, "cancelada");
  return { l, vig };
}

test("solo necesidades vigente aparecen (descarta comprada/cancelada)", () => {
  const { l } = libroMixto();
  const lista = listaPublica(l);
  assert.equal(lista.necesidades.length, 1, "solo la vigente");
  assert.equal(lista.necesidades[0].insumo, "gasas");
});

test("recorte de campos: solo zona, insumo, urgencia", () => {
  const { l } = libroMixto();
  const item = listaPublica(l).necesidades[0];
  assert.deepEqual(Object.keys(item).sort(), ["insumo", "urgencia", "zona"]);
});

test("cero PII / cero detalle interno en la salida", () => {
  const { l } = libroMixto();
  const json = JSON.stringify(listaPublica(l));
  // nombres de destino con detalle (hospital/doctor), estado interno, reportes, id → NO
  assert.ok(!json.includes("Pérez Carreño") && !json.includes("Massieu"), "nombres de lugar/persona NO");
  assert.ok(!json.includes("reportes") && !json.includes("estado") && !json.includes("#1"), "campos internos NO");
  assert.ok(!json.includes("costo") && !json.includes("comprada"), "costos/estado interno NO");
});

test("al resolverse una necesidad desaparece de la lista", () => {
  const { l, vig } = libroMixto();
  assert.equal(listaPublica(l).necesidades.length, 1);
  setEstadoManual(l, vig.id, "cancelada"); // resolver la única vigente
  assert.equal(listaPublica(l).necesidades.length, 0, "ya no aparece en la próxima publicación");
});
