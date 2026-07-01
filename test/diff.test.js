/* ingesta-07 — diff/eventos entre corridas. Gate: dos snapshots sintéticos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { diff } from "../src/ingest/diff.js";

const persona = (id, estado) => ({ sourceId: "encuentralos", categoria: "persona", payload: { id, nombre: "X", estado }, coords: null });
const dano = (lat, severity) => ({ categoria: "dano", payload: { severity }, coords: { lat, lng: -66.8 } });

test("diff: sin previo → todo 'nuevo', ningún 'cambio-estado'", () => {
  const ev = diff([], [persona("a", "missing"), persona("b", "found")], "persona");
  assert.equal(ev.length, 2);
  assert.ok(ev.every((e) => e.tipo === "nuevo"));
  assert.equal(ev.find((e) => e.despues === "found").revision, true);    // encontrado nuevo → crítico
  assert.equal(ev.find((e) => e.despues === "missing").revision, false);
});

test("diff: missing→found emite cambio-estado con revisión; sin cambio no emite", () => {
  const prev = [persona("a", "missing"), persona("b", "missing")];
  const curr = [persona("a", "found"), persona("b", "missing")];
  const ev = diff(prev, curr, "persona");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tipo, "cambio-estado");
  assert.equal(ev[0].antes, "missing");
  assert.equal(ev[0].despues, "found");
  assert.equal(ev[0].revision, true);
});

test("diff: nuevo fallecido → crítico; daño nuevo por geo → nuevo sin revisión", () => {
  const evP = diff([persona("a", "missing")], [persona("a", "missing"), persona("c", "deceased")], "persona");
  assert.equal(evP.length, 1);
  assert.equal(evP[0].despues, "deceased");
  assert.equal(evP[0].revision, true);
  const evD = diff([dano(10, "parcial")], [dano(10, "parcial"), dano(11, "total")], "dano");
  assert.equal(evD.length, 1);
  assert.equal(evD[0].tipo, "nuevo");
  assert.equal(evD[0].revision, false);         // daño no es evento crítico-persona
});

test("diff: identidad de daño por geo redondeada (~4 decimales) → mismo edificio, sin evento", () => {
  assert.equal(diff([dano(10.61239, "total")], [dano(10.61241, "total")], "dano").length, 0);
});
