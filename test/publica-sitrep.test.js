/* Gate failable de destilación → store: el writer agrega con procedencia/frescura,
   deduplica y rechaza lo que no tiene fuente. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { merge } from "../scripts/publica-sitrep.js";

test("publica-sitrep: agrega + autocompleta fecha, deduplica, rechaza sin procedencia", () => {
  const store = { items: [{ titulo: "A", zona: "Z", texto: "x", fuenteOrigen: "X", verificadoEl: "2026-06-26" }] };

  // agrega uno nuevo y autocompleta verificadoEl con 'hoy'
  assert.equal(merge(store, { items: [{ titulo: "B", zona: "Z", texto: "t", fuenteOrigen: "Y" }] }, "2026-06-27"), 1);
  assert.equal(store.items.find((i) => i.titulo === "B").verificadoEl, "2026-06-27");

  // dedup: mismo titulo+zona no se vuelve a agregar
  assert.equal(merge(store, [{ titulo: "A", zona: "Z", texto: "x", fuenteOrigen: "X" }], "2026-06-27"), 0);

  // rechaza sin procedencia (fuenteOrigen)
  assert.throws(() => merge(store, [{ titulo: "C", texto: "t" }], "2026-06-27"), /fuenteOrigen/);
});
