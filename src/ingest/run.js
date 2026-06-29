/* Orquestador de ingesta. Corre adaptadores read-only → escribe data/bundles/<cat>.json.
   Resiliente: si una fuente falla, degrada (bundle vacío) y sigue — el gate es el test de normalize. */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as sismosve from "./sismosve.js";
import * as usgs from "./usgs.js";
import * as ayudave from "./ayudave.js";
import * as terremoto from "./terremotovenezuela.js";
import * as crisisvenezuela from "./crisisvenezuela.js";
import * as ayudared from "./ayudaredve.js";
import * as hub from "./hub.js";
import * as geocoder from "./geocoder.js";
// acopiovenezuela: en pausa — sus centros ya entran vía AyudaVE (source: acopiovenezuela.vercel.app)
// y no expone /api ni __NEXT_DATA__ estable. Re-activar si se confirma un endpoint.

const BUNDLE_DIR = fileURLToPath(new URL("../../data/bundles", import.meta.url));

async function safe(fn, label) {
  try { return await fn(); } catch (e) { console.warn(`  ! ${label}: ${e.message}`); return []; }
}

async function buildReplicas() {
  let items = await safe(() => sismosve.fetchRegistros(), "sismosve");
  let source = "sismosve";
  if (!items.length) { items = await safe(() => usgs.fetchRegistros(), "usgs (fallback)"); source = "usgs"; }
  return { categoria: "replica", source, items, fetchedAt: new Date().toISOString() };
}

async function buildCentros() {
  const a = await safe(() => ayudave.fetchRegistros(), "ayudave");
  // A2: AyudaVE entrega coords:null → geocodifica (Nominatim opt-in + fallback centroide de estado).
  const items = await safe(() => geocoder.enrichCentros(a), "geocode");
  return { categoria: "centro", source: "ayudave", items: items.length ? items : a, fetchedAt: new Date().toISOString() };
}

async function buildDanos() {
  // crisisvenezuela = daños corroborados (texto libre + procedencia); terremoto de fallback.
  let items = await safe(() => crisisvenezuela.fetchRegistros(), "crisisvenezuela");
  let source = "crisisvenezuela";
  if (!items.length) { items = await safe(() => terremoto.fetchRegistros(), "terremotovenezuela (fallback)"); source = "terremotovenezuela"; }
  // hub = daños estructurados con geo + foto (complementa, no reemplaza).
  const h = await safe(() => hub.fetchRegistros("damaged_building"), "hub damaged_building");
  if (h.length) { items = items.concat(h); source += "+hub"; }
  return { categoria: "dano", source, items, fetchedAt: new Date().toISOString() };
}

async function buildDemanda() {
  // Ayuda Venezuela Red + hub help_request: DEMANDA estructurada, no verificada.
  // Solo captura interna — NO se publica en el API público hasta resolver licencia.
  let items = await safe(() => ayudared.fetchRegistros(), "ayuda-venezuela-red");
  let source = "ayuda-venezuela-red";
  const h = await safe(() => hub.fetchRegistros("help_request"), "hub help_request");
  if (h.length) { items = items.concat(h); source += "+hub"; }
  return { categoria: "zona", source, items, fetchedAt: new Date().toISOString() };
}

async function buildOferta() {
  // hub help_offer: OFERTA de ayuda (voluntarios/recursos) — categoría nueva, no verificada.
  // Captura interna — NO publicar en /v1 sin licencia (ver hub.js).
  const items = await safe(() => hub.fetchRegistros("help_offer"), "hub help_offer");
  return { categoria: "oferta", source: "terremotovenezuela-hub", items, fetchedAt: new Date().toISOString() };
}

// TODO(Sx): añadir builders restantes (personas, refugios, hospitales, mascotas) en sus slices.
//   hub también expone missing_person/checkin (categoria persona, con nombre) → va al slice de personas, no aquí.
const BUNDLES = { replicas: buildReplicas, centros: buildCentros, danos: buildDanos, demanda: buildDemanda, oferta: buildOferta };

async function main() {
  await mkdir(BUNDLE_DIR, { recursive: true });
  for (const [name, build] of Object.entries(BUNDLES)) {
    const bundle = await build();
    await writeFile(`${BUNDLE_DIR}/${name}.json`, JSON.stringify(bundle));
    console.log(`  ✓ ${name}.json — ${bundle.items.length} registros (${bundle.source})`);
  }
  console.log(`ingest: ${Object.keys(BUNDLES).length} bundle(s) escritos en data/bundles/.`);
}
main();
