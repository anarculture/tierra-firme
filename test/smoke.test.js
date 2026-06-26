/* Smoke test (node:test). Trivial pero FAILABLE: amarra la ley de estructura.
   Si alguien rompe el modelo o el manifiesto, este check falla. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ESTADO_PERSONA, CATEGORIAS } from "../src/model/index.js";

test("modelo: Persona transita desaparecida→localizada (Q3)", () => {
  assert.equal(ESTADO_PERSONA.DESAPARECIDA, "desaparecida");
  assert.equal(ESTADO_PERSONA.LOCALIZADA, "localizada");
  assert.ok(CATEGORIAS.includes("persona") && CATEGORIAS.includes("replica"));
});

test("manifiesto de Fuentes parsea y trae fuentes", async () => {
  const m = JSON.parse(await readFile(new URL("../sources.manifest.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(m.fuentes) && m.fuentes.length > 0);
});
