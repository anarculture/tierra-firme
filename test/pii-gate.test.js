/* ingesta-06 — gate PII al servir personas. Falla si la cédula cruda saldría sin canal gateado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { serveBody, redactPersonas, maskCedula, PII_BUNDLES } from "../src/api/pii-gate.js";

const bundle = () => ({ categoria: "persona", items: [{ sourceId: "encuentralos", categoria: "persona",
  payload: { id: "u1", nombre: "Félix Urbano", cedula: "25369306", estado: "missing", ubicacion: "Catia", edad: 26 } }] });

test("pii-gate: público (sin key) → cédula enmascarada, nombre/foto/id fuera, sin fuga cruda", () => {
  const out = serveBody("personas", bundle(), null, "SECRET");
  const p = out.items[0].payload;
  assert.equal(p.cedula, "****9306");
  assert.equal("nombre" in p, false);
  assert.equal("id" in p, false);
  assert.equal(p.estado, "missing");                            // agregado se conserva (mapa/conteo)
  assert.equal(p.edad, 26);
  const s = JSON.stringify(out);
  assert.ok(!s.includes("25369306"), "FUGA PII: cédula cruda en la salida");
  assert.ok(!s.includes("Félix"), "FUGA PII: nombre en la salida");
});

test("pii-gate: canal gateado (key correcta) → payload completo", () => {
  const p = serveBody("personas", bundle(), "SECRET", "SECRET").items[0].payload;
  assert.equal(p.cedula, "25369306");
  assert.equal(p.nombre, "Félix Urbano");
});

test("pii-gate: sin TF_API_KEY en entorno → fail-closed (siempre redacta)", () => {
  assert.equal(serveBody("personas", bundle(), "SECRET", "").items[0].payload.cedula, "****9306");
});

test("pii-gate: bundle público (no-PII) pasa intacto", () => {
  const b = { items: [{ payload: { severity: "total" } }] };
  assert.equal(serveBody("centros", b, null, "SECRET"), b);
  assert.ok(!PII_BUNDLES.has("centros"));
});

test("maskCedula: solo últimos 4, tolera formato con puntos/guion; vacío → ''", () => {
  assert.equal(maskCedula("V-25.369.306"), "****9306");
  assert.equal(maskCedula(null), "");
  assert.equal(redactPersonas({}).items.length, 0);            // tolera bundle vacío
});
