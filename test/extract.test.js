// Self-check de src/extract.js: el gate de umbral/relevancia y la normalización.
// Pura, sin red (no toca Gemini). node:test = el gate del repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, normalizeVlm, SUPPLY_SPEC } from "../src/extract.js";

test("decide: confianza >= umbral y relevante ⇒ no revisar", () => {
  const r = decide({ items: [{ fields: {}, confidence: 0.9 }], relevant: true, relevanceNote: "", confidence: 0.9 }, 0.7);
  assert.equal(r.needsReview, false);
  assert.equal(r.items.length, 1);
});

test("decide: confianza < umbral ⇒ revisar", () => {
  const r = decide({ items: [], relevant: true, relevanceNote: "", confidence: 0.5 }, 0.7);
  assert.equal(r.needsReview, true);
});

test("decide: no relevante ⇒ revisar aunque la confianza sea alta", () => {
  const r = decide({ items: [], relevant: false, relevanceNote: "comprobante", confidence: 0.99 }, 0.7);
  assert.equal(r.needsReview, true);
  assert.equal(r.relevant, false);
});

test("decide: clamp de confianza a [0,1]", () => {
  assert.equal(decide({ items: [], relevant: true, confidence: 5 }).confidence, 1);
  assert.equal(decide({ items: [], relevant: true, confidence: -3 }).confidence, 0);
});

test("normalizeVlm: mapea campos del spec y ausentes ⇒ null", () => {
  const raw = {
    relevant: true,
    relevanceNote: "",
    confidence: 0.8,
    items: [{ articulo: { value: "guantes", confidence: 0.9 }, cantidad: { value: 20, confidence: 0.8 }, confidence: 0.85 }],
  };
  const v = normalizeVlm(raw, SUPPLY_SPEC);
  assert.equal(v.items[0].fields.articulo.value, "guantes");
  assert.equal(v.items[0].fields.cantidad.value, 20);
  assert.equal(v.items[0].fields.unidad.value, null); // ausente ⇒ null
  assert.equal(v.items[0].confidence, 0.85);
});
