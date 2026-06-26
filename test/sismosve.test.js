/* S1 — gate failable: normalize de réplicas (SismosVE + USGS) → Registro. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize as normSismos } from "../src/ingest/sismosve.js";
import { normalize as normUsgs } from "../src/ingest/usgs.js";

test("sismosve.normalize: item → Registro replica", () => {
  const out = normSismos({ sismos: [{ magnitud: "4.5", profundidad: "7.5", latitud: "10.45", longitud: "-68.51", lugar: "6 km W Naiguatá", fecha: "2026-06-25T03:48:00Z" }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].categoria, "replica");
  assert.equal(out[0].sourceId, "sismosve");
  assert.equal(out[0].payload.mag, 4.5);
  assert.deepEqual(out[0].coords, { lat: 10.45, lng: -68.51 });
});

test("usgs.normalize: feature → Registro replica", () => {
  const out = normUsgs({ features: [{ properties: { mag: 5.1, place: "Carabobo", time: 1750000000000 }, geometry: { coordinates: [-68.2, 10.3, 10] } }] });
  assert.equal(out[0].payload.mag, 5.1);
  assert.deepEqual(out[0].coords, { lat: 10.3, lng: -68.2 });
});

test("normalize tolera input vacío", () => {
  assert.deepEqual(normSismos(null), []);
  assert.deepEqual(normUsgs({}), []);
});
