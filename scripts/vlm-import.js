/* Importador one-shot: ítems ya extraídos por el VLM (cleaner/media-vlm/resultados-vlm.json)
   → draft del pipeline needs (data/analisis-<date>.json). NO publica: el gate humano sigue
   siendo `node scripts/publica.js <date>` (revisá el draft y publicá a site/needs.json).

   Filtro de correctitud (NO lazy-skippable): solo relevant===true && kind==="NECESIDAD".
   Descarta OFERTA (ferretería) y relevant:false (comprobantes/cotizaciones con Bs/USD = PII).

   Uso:  node scripts/vlm-import.js [YYYY-MM-DD] [--dry]   (default date: hoy)
         node scripts/vlm-import.js 2026-06-29             (mergea en ese analisis)

   ponytail: zona/urgencia con default (la foto no los trae) → el operador ajusta en el
   draft. reportes suma 1 por foto; fuzzy-matching de nombres de hospital (HMPC vs
   "Hospital Pérez Carreño") NO se hace acá — es el issue #02 (ID estable). */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url);
const VLM = fileURLToPath(new URL("cleaner/media-vlm/resultados-vlm.json", ROOT));
const ANALISIS = (d) => fileURLToPath(new URL(`data/analisis-${d}.json`, ROOT));

const PLACEHOLDER = /no especificad/i; // "lista detallada no especificada en el volcado"

/** lugar limpio: quita SOLO el paréntesis de destinatario "(recibe …)" (ruido); conserva
 *  expansiones útiles como "HMPC (Hospital Miguel Pérez Carreño)". Colapsa espacios. */
export function limpiaLugar(destino) {
  return String(destino || "").replace(/\s*\(\s*recibe[^)]*\)/gi, "").replace(/\s+/g, " ").trim();
}

/** zona best-effort desde el lugar. ponytail: heurística por keyword; el operador corrige. */
export function zonaDe(lugar) {
  if (/guaira/i.test(lugar)) return "La Guaira";
  if (/petare/i.test(lugar)) return "Petare";
  return "Caracas"; // el batch es área metropolitana
}

/** item VLM → string "Artículo (cantidad unidad)" (omite lo nulo). */
function itemStr(fields) {
  const art = String(fields.articulo?.value ?? "").trim();
  if (!art) return "";
  const q = [fields.cantidad?.value, fields.unidad?.value]
    .filter((x) => x != null && String(x).trim() !== "")
    .join(" ")
    .trim();
  return q ? `${art} (${q})` : art;
}

/** records VLM → { necesidades[], needsDestino[] }. Agrupa por lugar normalizado. */
export function toNecesidades(records) {
  const porLugar = new Map();
  const needsDestino = [];
  for (const r of records || []) {
    if (r.relevant !== true || r.kind !== "NECESIDAD") continue; // descarta OFERTA + relevant:false
    let lugar = limpiaLugar(r.destino);
    if (!lugar) { lugar = "Por ubicar (revisar)"; needsDestino.push(r.archivo); }
    const items = (r.items || []).map((it) => itemStr(it.fields || {})).filter(Boolean);
    if (!items.length) continue;
    const cur = porLugar.get(lugar) || { zona: zonaDe(lugar), lugar, items: [], urgencia: "media", reportes: 0 };
    for (const s of items) if (!cur.items.includes(s)) cur.items.push(s);
    cur.reportes += 1; // 1 por foto que aporta
    porLugar.set(lugar, cur);
  }
  return { necesidades: [...porLugar.values()], needsDestino };
}

/** Mergea necesidades de fotos en la base (no clobber). Match por lugar normalizado:
 *  une items, quita placeholders "no especificada", suma reportes. */
export function mergeNecesidades(base, add) {
  const norm = (s) => limpiaLugar(s).toLowerCase();
  const out = base.map((n) => ({ ...n, items: [...n.items] }));
  for (const nu of add) {
    const ex = out.find((n) => norm(n.lugar) === norm(nu.lugar));
    if (ex) {
      ex.items = ex.items.filter((it) => !PLACEHOLDER.test(it)); // llegan ítems reales
      for (const s of nu.items) if (!ex.items.includes(s)) ex.items.push(s);
      ex.reportes = (ex.reportes || 0) + nu.reportes;
    } else {
      out.push(nu);
    }
  }
  return out;
}

async function main() {
  const arg = process.argv[2];
  const date = arg && !arg.startsWith("--") ? arg : new Date().toISOString().slice(0, 10);
  const dry = process.argv.includes("--dry");
  if (!existsSync(VLM)) { console.error(`sin extracción VLM (${VLM}) — corré npm run extract-media primero`); process.exit(1); }
  const records = JSON.parse(await readFile(VLM, "utf8"));
  const { necesidades: add, needsDestino } = toNecesidades(records);
  const base = existsSync(ANALISIS(date)) ? JSON.parse(await readFile(ANALISIS(date), "utf8")) : { date, resumen: "", necesidades: [] };
  const merged = mergeNecesidades(base.necesidades || [], add);
  const out = { ...base, date: base.date || date, necesidades: merged };
  if (needsDestino.length) console.warn(`⚠️  ${needsDestino.length} foto(s) sin destino → "Por ubicar (revisar)": ${needsDestino.join(", ")}`);
  console.log(`${add.length} necesidad(es) de fotos → ${merged.length} total en analisis-${date}.json${dry ? " (dry)" : ""}`);
  if (dry) { console.log(JSON.stringify(out.necesidades, null, 2)); return; }
  await writeFile(ANALISIS(date), JSON.stringify(out, null, 2) + "\n");
  console.log(`escrito data/analisis-${date}.json — revisá y publicá: node scripts/publica.js ${date}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
