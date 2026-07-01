/* Valida site/needs.json contra el shape que site/index.html espera renderizar.
   El shape es el MISMO que produce scripts/analiza.js (necesidades[] con
   zona/lugar/items/urgencia/reportes) para que su salida alimente este sitio
   sin transformación. `estado` es un overlay opcional (default vigente).
   Si el dato deriva, rompe acá, no en silencio en el navegador del voluntario. */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NEEDS = fileURLToPath(new URL("../site/needs.json", import.meta.url));
const URGENCIA = new Set(["alta", "media", "baja"]);
const ESTADO = new Set(["vigente", "cubierta", "cancelada"]);

test("needs.json: shape analiza.js que la página renderiza", () => {
  const data = JSON.parse(readFileSync(NEEDS, "utf8"));
  assert.ok(/^\d{4}-\d{2}-\d{2}/.test(data.date || ""), "date debe ser YYYY-MM-DD (la página calcula frescura con él)");
  assert.ok(Array.isArray(data.necesidades) && data.necesidades.length, "necesidades debe ser array no vacío");
  for (const [i, n] of data.necesidades.entries()) {
    const at = `necesidades[${i}] (${n.lugar ?? "?"})`;
    assert.ok(typeof n.zona === "string" && n.zona.trim(), `${at}: falta zona`);
    assert.ok(typeof n.lugar === "string" && n.lugar.trim(), `${at}: falta lugar`);
    assert.ok(Array.isArray(n.items) && n.items.length, `${at}: items debe ser array no vacío`);
    assert.ok(n.items.every((it) => typeof it === "string" && it.trim()), `${at}: items deben ser strings`);
    assert.ok(URGENCIA.has(n.urgencia), `${at}: urgencia inválida → ${n.urgencia}`);
    assert.ok(Number.isInteger(n.reportes) && n.reportes >= 1, `${at}: reportes debe ser entero ≥1 → ${n.reportes}`);
    if ("estado" in n) assert.ok(ESTADO.has(n.estado), `${at}: estado inválido → ${n.estado}`);
  }
});
