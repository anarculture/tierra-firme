/* A2 — gate failable del geocoder de centros.
   (a) estadoCentroids() devuelve un centroide para "Falcón" dentro del bbox de Venezuela.
   (b) un centro sin coords con estado "Miranda" recibe coords vía fallback de estado (sin red). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoCentroids, geocode } from "../src/ingest/geocoder.js";

const inVE = (lat, lng) => lat >= 0 && lat <= 13 && lng >= -74 && lng <= -59;

test("estadoCentroids: Falcón cae dentro del bbox de Venezuela", () => {
  const c = estadoCentroids();
  const fal = c["Falcón"];
  assert.ok(fal, "debe existir centroide para Falcón");
  assert.ok(inVE(fal.lat, fal.lng), `Falcón fuera de bbox: ${JSON.stringify(fal)}`);
});

test("geocode: estado Miranda sin red → fallback de estado", async () => {
  // networkDown:true fuerza el fallback sin tocar Nominatim (determinista, sin red).
  const coords = await geocode("Calle inventada 123", "Miranda", "Sucre", {}, {
    state: { networkDown: true },
  });
  assert.ok(coords, "debe devolver coords vía fallback");
  assert.equal(coords.source, "estado");
  assert.equal(coords.confidence, "baja");
  assert.ok(inVE(coords.lat, coords.lng), `Miranda fuera de bbox: ${JSON.stringify(coords)}`);
});

test("geocode: cache hit se devuelve tal cual", async () => {
  const cache = {};
  const c1 = await geocode("Dir X", "Miranda", "Sucre", cache, { state: { networkDown: true } });
  // siembra manual de cache para verificar el camino de cache
  const key = "miranda|sucre|dir x";
  cache[key] = { lat: 1, lng: -70, source: "nominatim", confidence: "alta" };
  const c2 = await geocode("Dir X", "Miranda", "Sucre", cache, { state: { networkDown: true } });
  assert.equal(c2.source, "nominatim");
  assert.equal(c2.lat, 1);
  assert.notEqual(c1.source, c2.source); // antes era 'estado', ahora viene de cache
});
