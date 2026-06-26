/* P1 — gate failable: applyPublish (publica aprobados + poda borradores; exige procedencia). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPublish } from "../scripts/revisar-server.js";

const hoy = "2026-06-26";

test("publica aprobados al store y los quita de borradores", () => {
  const store = { items: [] };
  const drafts = { items: [
    { titulo: "A", zona: "La Guaira", texto: "t", fuenteOrigen: "IFRC" },
    { titulo: "B", zona: "Carabobo", texto: "t", fuenteOrigen: "OCHA" }
  ] };
  const { added, remaining } = applyPublish(store, drafts, [drafts.items[0]], hoy);
  assert.equal(added, 1);
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].titulo, "A");
  assert.equal(store.items[0].verificadoEl, hoy); // frescura autocompletada
  assert.deepEqual(remaining.items.map((d) => d.titulo), ["B"]); // borrador podado
});

test("rechaza item sin procedencia (fuenteOrigen)", () => {
  assert.throws(() => applyPublish({ items: [] }, { items: [] }, [{ titulo: "X", zona: "z", texto: "t" }], hoy));
});
