/* S3/S4 — gate failable: normalize de centros (AyudaVE) y daños (terremotovenezuela). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize as nAyuda } from "../src/ingest/ayudave.js";
import { normalize as nTerr } from "../src/ingest/terremotovenezuela.js";
import { normalize as nCrisis } from "../src/ingest/crisisvenezuela.js";
import { normalize as nAyudaRed } from "../src/ingest/ayudaredve.js";
import { normalize as nHub } from "../src/ingest/hub.js";
import { normalize as nEnc } from "../src/ingest/encuentralos.js";

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

test("hub.normalize: un source federado mapea cada tipo a su categoria", () => {
  const hr = nHub("help_request", { reports: [{ hub_id: "h1", source: "venezuela-ayuda.com",
    city: "La Guaira", place_name: "Maiquetia", description: "necesitamos comida",
    category: "food", urgency: "MEDIUM", status: "OPEN", lat: 10.59, lng: -66.94 }] });
  assert.equal(hr[0].categoria, "zona");                 // help_request → demanda
  assert.equal(hr[0].sourceId, "terremotovenezuela-hub");
  assert.equal(hr[0].payload.urgencia, "MEDIUM");
  assert.equal(hr[0].payload.verificado, false);         // federado sin verificar
  assert.equal(hr[0].payload.fuente, "venezuela-ayuda.com");
  assert.deepEqual(hr[0].coords, { lat: 10.59, lng: -66.94 });

  const off = nHub("help_offer", [{ hub_id: "h2", category: "medical", available: true, lat: null, lng: null }]);
  assert.equal(off[0].categoria, "oferta");
  assert.equal(off[0].payload.disponible, true);
  assert.equal(off[0].coords, null);                     // oferta sin geo → fuera del mapa

  const dmg = nHub("damaged_building", [{ hub_id: "h3", severity: "COLLAPSED",
    place_name: "Vista al mar", photo_url: "http://x.jpg", lat: 10.6, lng: -66.8 }]);
  assert.equal(dmg[0].categoria, "dano");                // damaged_building → daños
  assert.equal(dmg[0].payload.severity, "COLLAPSED");
  assert.equal(dmg[0].payload.photoUrl, "http://x.jpg");
});

test("hub.normalize: persona trae nombre pero NUNCA contacto (sin teléfono)", () => {
  const mp = nHub("missing_person", [{ hub_id: "h4", name: "Manuel R", status: "LOOKING_FOR_SOMEONE",
    phone: "0412-1234567", lat: 10.9, lng: -68.4 }]);  // aunque venga phone, no debe filtrarse
  assert.equal(mp[0].categoria, "persona");
  assert.equal(mp[0].payload.nombre, "Manuel R");
  assert.equal("phone" in mp[0].payload, false);         // sin PII de contacto
  assert.equal("telefono" in mp[0].payload, false);
});

test("encuentralos.normalize: persona → Registro con estado mapeado, geo, sin PII de reportante", () => {
  const out = nEnc([{
    id: "u1", nombre: "Félix Urbano", cedula: "25369306", edad: 26, sexo: "Masculino",
    estado: "desaparecido", ultima_ubicacion: "Catia La Mar", ultima_lat: 10.6, ultima_lng: -67.0,
    ultima_vez: "2026-06-25T19:11:44Z", descripcion: "alto", foto: "http://x/f.jpg", creado: "2026-06-27",
    reporta_contacto: "0412-9999999", pv_contacto: "0414-1", pv_por: "prima", pv_relacion: "familiar",
  }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].categoria, "persona");
  assert.equal(out[0].sourceId, "encuentralos");
  assert.equal(out[0].payload.estado, "missing");        // desaparecido → missing
  assert.equal(out[0].payload.cedula, "25369306");       // conservada para dedup interno
  assert.deepEqual(out[0].coords, { lat: 10.6, lng: -67.0 });
  // PII de terceros JAMÁS en el payload:
  for (const k of ["reporta_contacto", "pv_contacto", "pv_por", "pv_relacion", "pv_lugar", "pv_salud"])
    assert.equal(k in out[0].payload, false, `filtró ${k}`);
});

test("encuentralos.normalize: estado desconocido → 'unknown', sin geo → coords null", () => {
  const out = nEnc([{ nombre: "X", estado: "rescatado", ultima_lat: null, ultima_lng: null }]);
  assert.equal(out[0].payload.estado, "unknown");
  assert.equal(out[0].coords, null);
});

test("normalize tolera vacío", () => {
  assert.deepEqual(nAyuda(null), []);
  assert.deepEqual(nTerr({}), []);
  assert.deepEqual(nCrisis({}), []);
  assert.deepEqual(nAyudaRed(null), []);
  assert.deepEqual(nHub("help_request", {}), []);
  assert.deepEqual(nHub("tipo_desconocido", { reports: [{ hub_id: "x" }] }), []);
  assert.deepEqual(nEnc(null), []);
});
