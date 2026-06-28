/* S3/S4 — gate failable: normalize de centros (AyudaVE) y daños (terremotovenezuela). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize as nAyuda } from "../src/ingest/ayudave.js";
import { normalize as nTerr } from "../src/ingest/terremotovenezuela.js";
import { normalize as nCrisis } from "../src/ingest/crisisvenezuela.js";
import { normalize as nAyudaRed } from "../src/ingest/ayudaredve.js";

test("ayudave.normalize: centro con coords string → Registro", () => {
  const out = nAyuda([{ name: "Iglesia X", estado: "Falcón", coords: "11.4,-69.6", needs: [] }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].categoria, "centro");
  assert.equal(out[0].payload.estado, "Falcón");
  assert.deepEqual(out[0].coords, { lat: 11.4, lng: -69.6 });
});

test("ayudave.normalize: coords null → coords null (va al directorio, no al mapa)", () => {
  assert.equal(nAyuda([{ name: "Y", coords: null }])[0].coords, null);
});

test("terremotovenezuela.normalize: daño con lat/lng → Registro dano", () => {
  const out = nTerr({ reports: [{ latitud: 10.49, longitud: -68.2, level: "total" }] });
  assert.equal(out[0].categoria, "dano");
  assert.equal(out[0].payload.severity, "total");
  assert.deepEqual(out[0].coords, { lat: 10.49, lng: -68.2 });
});

test("crisisvenezuela.normalize: fact daño → Registro dano con procedencia", () => {
  const out = nCrisis({ datos: [{
    nivel: "colapso_total", municipio: "La Guaira", estado: "La Guaira", zona: "Caraballeda",
    lat: 10.61, lon: -66.85, descripcion: "Edificio colapsado", n_fuentes: 3,
    fuentes: [{ fuente: "X", url: "http://e" }], fecha: "2026-06-25T00:00:00Z"
  }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].categoria, "dano");
  assert.equal(out[0].payload.severity, "colapso_total");
  assert.equal(out[0].payload.place, "Caraballeda, La Guaira, La Guaira");
  assert.equal(out[0].payload.nFuentes, 3);             // corroboración preservada
  assert.equal(out[0].payload.fuentes.length, 1);       // procedencia preservada
  assert.deepEqual(out[0].coords, { lat: 10.61, lng: -66.85 });  // ojo: campo 'lon' del API
});

test("ayudaredve.normalize: zona une sus necesidades, marca verificado=false", () => {
  const zonas = [{ id: "z1", nombre: "Bomberos Yaracuy", estado: "Yaracuy", municipio: "San Felipe",
    severidad: "critica", personas_afectadas: "12000", latitud: "10.33", longitud: "-68.75" }];
  const neces = [{ zona_id: "z1", categoria: "agua", articulo: "Agua potable", cantidad: "500", prioridad: "urgente" },
                 { zona_id: "OTRA", categoria: "ropa", articulo: "x", cantidad: "1", prioridad: "alta" }];
  const out = nAyudaRed(zonas, neces);
  assert.equal(out.length, 1);
  assert.equal(out[0].categoria, "zona");
  assert.equal(out[0].payload.verificado, false);          // crowdsourced sin auth
  assert.equal(out[0].payload.personasAfectadas, 12000);   // string → int
  assert.equal(out[0].payload.necesidades.length, 1);      // solo la de z1
  assert.equal(out[0].payload.necesidades[0].categoria, "agua");
  assert.deepEqual(out[0].coords, { lat: 10.33, lng: -68.75 });
});

test("normalize tolera vacío", () => {
  assert.deepEqual(nAyuda(null), []);
  assert.deepEqual(nTerr({}), []);
  assert.deepEqual(nCrisis({}), []);
  assert.deepEqual(nAyudaRed(null), []);
});
