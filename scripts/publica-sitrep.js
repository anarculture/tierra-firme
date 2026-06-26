/* Destilación → store: publica al store de sitreps VERIFICADOS
   (src/curated/sitreps.json) los items que un humano YA aprobó del borrador de /sitrep.
   El gate humano = correr esto SOLO sobre lo aprobado; este script no destila ni publica solo.

   Uso:  node scripts/publica-sitrep.js <aprobados.json>
   aprobados.json = { "items": [ {titulo, texto, fuenteOrigen, zona?, verificadoEl?}, ... ] }
                    (o directamente un array de items)

   Reglas (ADR/CONTEXT): procedencia obligatoria (no entra sin fuenteOrigen); frescura
   obligatoria (verificadoEl se autocompleta con hoy si falta); dedup por titulo+zona;
   cero PII (las personas van al índice privado, NO aquí). */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const STORE = fileURLToPath(new URL("../src/curated/sitreps.json", import.meta.url));
const REQUIRED = ["titulo", "texto", "fuenteOrigen"]; // verificadoEl se autocompleta

const key = (it) => `${String(it.titulo ?? "").trim().toLowerCase()}|${String(it.zona ?? "").trim().toLowerCase()}`;

function normItem(it, hoy) {
  for (const k of REQUIRED) {
    if (!it[k] || !String(it[k]).trim()) throw new Error(`item sin "${k}": ${JSON.stringify(it)}`);
  }
  return { ...it, verificadoEl: it.verificadoEl || hoy };
}

/** Mezcla items aprobados en el objeto store (muta store.items). Devuelve cuántos agregó.
 *  Puro (sin IO) para que el test lo ejerza sin tocar disco. */
export function merge(store, aprobados, hoy) {
  const items = aprobados.items || aprobados;
  const seen = new Set(store.items.map(key));
  let added = 0;
  for (const raw of items) {
    const it = normItem(raw, hoy);
    if (seen.has(key(it))) continue; // ya está — no duplica
    store.items.push(it);
    seen.add(key(it));
    added++;
  }
  return added;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("uso: node scripts/publica-sitrep.js <aprobados.json>");
    process.exit(1);
  }
  const store = JSON.parse(await readFile(STORE, "utf8"));
  const aprobados = JSON.parse(await readFile(path, "utf8"));
  const hoy = new Date().toISOString().slice(0, 10);
  const n = merge(store, aprobados, hoy);
  await writeFile(STORE, JSON.stringify(store, null, 2) + "\n");
  console.log(`publicados ${n} sitrep(s) → src/curated/sitreps.json (total: ${store.items.length})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
