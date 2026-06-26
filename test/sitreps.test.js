/* B1 — gate failable: sitreps verificados con procedencia. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("sitreps: cada uno con título, texto y procedencia/fecha", async () => {
  const j = JSON.parse(await readFile(new URL("../src/curated/sitreps.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(j.items));
  for (const s of j.items) {
    for (const k of ["titulo", "texto", "fuenteOrigen", "verificadoEl"]) {
      assert.ok(s[k], `sitrep sin "${k}": ${JSON.stringify(s)}`);
    }
  }
});
