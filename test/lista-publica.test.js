/* Gate de la lista pública recortada (issue 05 + 10): solo `vigente`, campos seguros
   zona+insumo+urgencia, `lugar` SOLO para instituciones públicas mapeables (nunca PII de
   persona), cero detalle interno. */
import { test } from "node:test";
import assert from "node:assert";
import { emptyLibro, ingestNecesidad, ingestCompra, setEstadoManual } from "../src/libro.js";
import { listaPublica, lugarPublico } from "../src/lista-publica.js";

function libroMixto() {
  const l = emptyLibro();
  const vig = ingestNecesidad(l, { destino: { nombre: "Hospital Pérez Carreño", tipo: "hospital", zona: "Caracas" }, insumo: "gasas", urgencia: "alta" }).necesidad;
  const compr = ingestNecesidad(l, { destino: { nombre: "Hospital Vargas", tipo: "hospital", zona: "La Guaira" }, insumo: "agua", urgencia: "media" }).necesidad;
  const doctor = ingestNecesidad(l, { destino: { nombre: "Dr. Massieu", tipo: "doctor", zona: "Caracas" }, insumo: "insulina", urgencia: "alta" }).necesidad;
  ingestCompra(l, { items: [{ insumo: "agua", cantidad: 1, costo_unitario: 1 }], necesidad_id: compr.id }); // → comprada, fuera
  return { l, vig, doctor };
}

test("solo necesidades vigente aparecen (descarta comprada)", () => {
  const { l } = libroMixto();
  const insumos = listaPublica(l).necesidades.map((n) => n.insumo).sort();
  assert.deepEqual(insumos, ["gasas", "insulina"], "agua (comprada) fuera; gasas + insulina vigentes");
});

test("campos: zona, insumo, urgencia siempre; lugar solo para institución pública", () => {
  const { l } = libroMixto();
  const lista = listaPublica(l);
  const gasas = lista.necesidades.find((n) => n.insumo === "gasas");
  const insulina = lista.necesidades.find((n) => n.insumo === "insulina");
  assert.equal(gasas.lugar, "Hospital Pérez Carreño", "hospital = infraestructura pública, mapeable");
  assert.ok(!("lugar" in insulina), "destino tipo doctor (PII) → sin lugar");
});

test("PII de persona nunca sale; instituciones sí; cero campos internos", () => {
  const { l } = libroMixto();
  const json = JSON.stringify(listaPublica(l));
  assert.ok(!json.includes("Massieu"), "nombre de doctor (PII) NUNCA sale");
  assert.ok(!json.includes("reportes") && !json.includes("estado") && !json.includes("#") && !json.includes("costo"), "campos internos NO");
});

test("lugarPublico: solo instituciones con nombre mapeable", () => {
  assert.equal(lugarPublico({ nombre: "Hospital X", tipo: "hospital" }), "Hospital X");
  assert.equal(lugarPublico({ nombre: "Centro de acopio Chacao", tipo: "centro_acopio" }), "Centro de acopio Chacao");
  assert.equal(lugarPublico({ nombre: "Dr. Pérez", tipo: "doctor" }), null, "persona → null");
  assert.equal(lugarPublico({ nombre: "General", tipo: "hospital" }), null, "genérico exacto → null");
  assert.equal(lugarPublico({ nombre: "Por ubicar (revisar)", tipo: "punto_apoyo" }), null, "no mapeable → null");
});

test("placeholder es NOMBRE COMPLETO, no substring: 'Hospital General del Oeste' conserva lugar (regresión #10)", () => {
  assert.equal(lugarPublico({ nombre: "Hospital General del Oeste", tipo: "hospital" }), "Hospital General del Oeste");
  assert.equal(lugarPublico({ nombre: "Hospital General del Este", tipo: "hospital" }), "Hospital General del Este");
  assert.equal(lugarPublico({ nombre: "N/D", tipo: "hospital" }), null, "placeholder N/D → null (no pin basura)");
  assert.equal(lugarPublico({ nombre: "?", tipo: "punto_apoyo" }), null);
});

test("al resolverse una necesidad desaparece de la lista", () => {
  const { l, vig } = libroMixto();
  assert.equal(listaPublica(l).necesidades.some((n) => n.insumo === "gasas"), true);
  setEstadoManual(l, vig.id, "cancelada");
  assert.equal(listaPublica(l).necesidades.some((n) => n.insumo === "gasas"), false, "ya no aparece");
});
