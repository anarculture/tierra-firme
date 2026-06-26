/* S7 — gate failable: catálogo de servicios con procedencia. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("servicios: ≥6 entradas, cada una con tipo + cómo contactar + procedencia", async () => {
  const j = JSON.parse(await readFile(new URL("../src/curated/servicios.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(j.items) && j.items.length >= 6, "deben ser ≥6 servicios");
  for (const it of j.items) {
    for (const k of ["tipo", "titulo", "comoContactar", "fuenteOrigen", "verificadoEl"]) {
      assert.ok(it[k], `servicio sin "${k}": ${JSON.stringify(it)}`);
    }
  }
});
