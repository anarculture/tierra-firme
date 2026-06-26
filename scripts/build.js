/* Gate de BUILD. Scaffold: valida que los JSON declarativos parseen (check failable real).
   TODO(Sx): emitir bundles JSON del colector a data/bundles/ para la lectura estática. */
import { readFile, readdir } from "node:fs/promises";

const manifestUrl = new URL("../sources.manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
if (!Array.isArray(manifest.fuentes)) throw new Error('sources.manifest.json: "fuentes" debe ser un array');

const curatedDir = new URL("../src/curated/", import.meta.url);
let curated = 0;
for (const f of await readdir(curatedDir)) {
  if (f.endsWith(".json")) { JSON.parse(await readFile(new URL(f, curatedDir), "utf8")); curated++; }
}

console.log(`build OK — ${manifest.fuentes.length} fuentes, ${curated} curated válidos. (scaffold: sin bundles aún) TODO(Sx)`);
