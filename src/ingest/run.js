/* Orquestador de ingesta. Corre adaptadores read-only → escribe data/bundles/<cat>.json.
   Resiliente: si una fuente falla, degrada (bundle vacío) y sigue — el gate es el test de normalize. */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as sismosve from "./sismosve.js";
import * as usgs from "./usgs.js";
import * as ayudave from "./ayudave.js";
import * as terremoto from "./terremotovenezuela.js";
import * as crisisvenezuela from "./crisisvenezuela.js";
import * as ayudared from "./ayudaredve.js";
import * as hub from "./hub.js";
import * as encuentralos from "./encuentralos.js";
import * as geocoder from "./geocoder.js";
// acopiovenezuela: en pausa — sus centros ya entran vía AyudaVE (source: acopiovenezuela.vercel.app)
// y no expone /api ni __NEXT_DATA__ estable. Re-activar si se confirma un endpoint.

const BUNDLE_DIR = fileURLToPath(new URL("../../data/bundles", import.meta.url));

async function safe(fn, label) {
  try { return await fn(); } catch (e) { console.warn(`  ! ${label}: ${e.message}`); return []; }
}

// Lee los items del bundle previo (o [] si no existe/corrupto) — base del merge incremental.
async function readBundle(name) {
  try { return JSON.parse(await readFile(`${BUNDLE_DIR}/${name}.json`, "utf8")).items ?? []; }
  catch { return []; }
}
// Watermark = último `creado` ya ingerido; dedup por id/cédula (lo nuevo, agregado al final, gana).
const maxCreado = (regs) => regs.reduce((m, r) => { const c = r.payload?.creado; return c && (!m || c > m) ? c : m; }, null);
const keyOf = (r) => r.payload?.id || r.payload?.cedula || `${r.payload?.nombre}|${r.payload?.ubicacion}|${r.payload?.creado}`;
const dedupById = (regs) => { const m = new Map(); for (const r of regs) m.set(keyOf(r), r); return [...m.values()]; };

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
  // Ayuda Venezuela Red: zonas + necesidades (DEMANDA estructurada, no verificada).
  // Aliado con permiso → SÍ se publica en /v1/demanda (licencia ALIADO). Solo este source:
  // mezclar hub (sin licencia) aquí lo serviría bajo la atribución del aliado. Va a demanda-hub.
  const items = await safe(() => ayudared.fetchRegistros(), "ayuda-venezuela-red");
  return { categoria: "zona", source: "ayuda-venezuela-red", items, fetchedAt: new Date().toISOString() };
}

async function buildDemandaHub() {
  // hub help_request: misma categoría (zona) pero SIN licencia declarada → captura INTERNA.
  // Bundle aparte, NO en POLICY, para no publicarlo en /v1 bajo atribución ajena (ver hub.js).
  const items = await safe(() => hub.fetchRegistros("help_request"), "hub help_request");
  return { categoria: "zona", source: "terremotovenezuela-hub", items, fetchedAt: new Date().toISOString() };
}

async function buildOferta() {
  // hub help_offer: OFERTA de ayuda (voluntarios/recursos) — categoría nueva, no verificada.
  // Captura interna — NO publicar en /v1 sin licencia (ver hub.js).
  const items = await safe(() => hub.fetchRegistros("help_offer"), "hub help_offer");
  return { categoria: "oferta", source: "terremotovenezuela-hub", items, fetchedAt: new Date().toISOString() };
}

async function buildPersonas() {
  // Encuéntralos: desaparecidos/encontrados (agregador ~107k) + hub missing_person/checkin.
  // INTERNO: sin licencia declarada + PII → bundle gitignored, gateado/redactado al servir (nunca /v1 crudo).
  // Incremental (F1): watermark = último `creado` del bundle previo → fetchRegistros trae solo lo nuevo
  //   y mergeamos con el encuentralos ya ingerido (dedup por id/cédula). 1ra corrida (o sin bundle) = full.
  const prevEnc = (await readBundle("personas")).filter((r) => r.sourceId === "encuentralos");
  const enc = await safe(() => encuentralos.fetchRegistros({ since: maxCreado(prevEnc) }), "encuentralos");
  const h = await safe(() => hub.fetchRegistros("missing_person"), "hub missing_person");
  const mergedEnc = dedupById([...prevEnc, ...enc]);   // safe()→[] no pierde lo previo; lo nuevo gana
  return { categoria: "persona", source: "encuentralos+hub", items: mergedEnc.concat(h), fetchedAt: new Date().toISOString() };
}

// TODO(Sx): builders restantes (refugios, hospitales, mascotas, donaciones) en sus slices — ver docs/PLAN-agente-ingesta.md.
const BUNDLES = { replicas: buildReplicas, centros: buildCentros, danos: buildDanos, personas: buildPersonas, demanda: buildDemanda, "demanda-hub": buildDemandaHub, oferta: buildOferta };

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
