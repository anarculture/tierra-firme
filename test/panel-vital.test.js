/* S0 — gate failable: Panel vital tiene contactos con procedencia. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("panel-vital: ≥7 contactos, cada uno con procedencia", async () => {
  const j = JSON.parse(await readFile(new URL("../src/curated/panel-vital.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(j.items) && j.items.length >= 7, "deben ser ≥7 contactos");
  for (const it of j.items) {
    for (const k of ["titulo", "contacto", "fuenteOrigen", "verificadoEl"]) {
      assert.ok(it[k], `contacto sin "${k}": ${JSON.stringify(it)}`);
    }
  }
});
