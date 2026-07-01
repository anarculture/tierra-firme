/* Valida site/needs.json contra la lista pública RECORTADA (issue 05 / ADR 0006):
   solo {fecha, necesidades:[{zona, insumo, urgencia}]}. Es el mismo shape que produce
   src/lista-publica.js. Si el dato deriva o se cuela un campo PII/interno, rompe acá —
   no en silencio en el navegador del donante. */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NEEDS = fileURLToPath(new URL("../site/needs.json", import.meta.url));
const URGENCIA = new Set(["alta", "media", "baja", "critica"]);
// `lugar` se permite SOLO para instituciones públicas (issue 10); el resto nunca.
const PROHIBIDOS = ["items", "reportes", "estado", "costo", "contacto", "quien", "id", "destino", "tipo"];

test("needs.json: shape de la lista pública recortada", () => {
  const data = JSON.parse(readFileSync(NEEDS, "utf8"));
  assert.ok(typeof (data.fecha ?? "") === "string", "fecha es string (puede ser '' antes de la 1a publicación)");
  assert.ok(Array.isArray(data.necesidades), "necesidades debe ser array");
  for (const [i, n] of data.necesidades.entries()) {
    const at = `necesidades[${i}]`;
    assert.ok(typeof n.zona === "string", `${at}: zona debe ser string`);
    assert.ok(typeof n.insumo === "string" && n.insumo.trim(), `${at}: falta insumo`);
    assert.ok(URGENCIA.has(n.urgencia), `${at}: urgencia inválida → ${n.urgencia}`);
    // recorte estricto: ningún campo PII / interno del modelo viejo
    for (const k of PROHIBIDOS) assert.ok(!(k in n), `${at}: campo prohibido en salida pública → ${k}`);
  }
});
