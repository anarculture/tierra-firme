/* Orquestador de ingesta. Corre adaptadores read-only → escribe data/bundles/<cat>.json.
   Resiliente: si una fuente falla, degrada (bundle vacío) y sigue — el gate es el test de normalize. */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as sismosve from "./sismosve.js";
import * as usgs from "./usgs.js";

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

// TODO(Sx): añadir builders por categoría (centros, personas, danos...) en sus slices.
const BUNDLES = { replicas: buildReplicas };

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
