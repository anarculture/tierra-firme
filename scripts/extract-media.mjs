#!/usr/bin/env node
// Lote: extrae listas de insumos de un directorio de imágenes (fotos del chat
// de WhatsApp) con Gemini (VLM). Lee el MANIFEST.md curado para adjuntar
// grupo/tipo/destino y SALTAR los ⚠️ (posibles menores/PII). Salida:
// resultados-vlm.json + resultados-vlm.csv (un renglón por ítem) + resumen.
// Estilo casa: vanilla + stdlib + fetch. Sin deps.
//
// Uso:  npm run extract-media -- [dir] [--dry] [--limit=N] [--delay=ms]
//   ANALIZA_API_KEY (o VLM_API_KEY) en .env · VLM_MODEL (def gemini-3.1-pro-preview)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractList, SUPPLY_SPEC } from "../src/extract.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = join(ROOT, "cleaner", "media-vlm");

// Carga mínima de .env (estilo src/api/server.js), sin pisar el entorno real.
function loadEnv() {
  const f = join(ROOT, ".env");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e?.message || "";
      if (i >= tries - 1 || !/429|RESOURCE_EXHAUSTED|rate|quota|503|overload/i.test(msg)) throw e;
      const wait = 2000 * 2 ** i;
      console.log(`     ⏳ rate-limit, reintento en ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

// Parser best-effort del MANIFEST.md: fileId -> {grupo,kind,destino,skip,skipReason}.
// ponytail: atado al formato actual; archivos sin match quedan sin metadata (no rompe).
function parseManifest(dir) {
  const map = new Map();
  const f = join(dir, "MANIFEST.md");
  if (!existsSync(f)) return map;
  let cur = null;
  const addIds = (rawText, meta) => {
    const text = rawText.replace(/`/g, " ");
    for (const rm of text.matchAll(/(\d{8})\s*[–-]\s*(\d{8})/g))
      for (let n = +rm[1]; n <= +rm[2]; n++) map.set(String(n).padStart(8, "0"), meta);
    for (const im of text.matchAll(/\d{8}/g)) map.set(im[0], meta);
  };
  for (const raw of readFileSync(f, "utf8").split("\n")) {
    const h = raw.match(/^###\s+(\d+)\.\s+(.*)$/);
    if (h) {
      const titulo = h[2].trim();
      const dash = titulo.lastIndexOf("—");
      const kind = (dash >= 0 ? titulo.slice(dash + 1) : "").replace(/\(.*$/, "").trim();
      const skip = titulo.includes("⚠️");
      cur = { grupo: h[1], titulo, kind, destino: "", skip, skipReason: skip ? "marcado ⚠️ en MANIFEST (posible PII/menores)" : "" };
      continue;
    }
    if (!cur) continue;
    if (/Archivos?:/.test(raw)) addIds(raw, cur);
    const d = raw.match(/Destino[^:]*:\s*(.+)$/);
    if (d) cur.destino = d[1].trim();
  }
  return map;
}

const fileId = (name) => (name.match(/\d{8}/)?.[0] ?? name);
const mime = (name) => (/\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : "image/jpeg");
const csv = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--")) || DEFAULT_DIR;
  const dry = args.includes("--dry");
  const limit = +(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || Infinity);
  const delay = +(args.find((a) => a.startsWith("--delay="))?.split("=")[1] || 1200);
  const only = (args.find((a) => a.startsWith("--only="))?.split("=")[1] || "").split(",").filter(Boolean);

  const apiKey = process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY || process.env.GEMINI_API_KEY || "";
  const model = process.env.VLM_MODEL || "gemini-3.1-pro-preview";
  const threshold = process.env.VLM_THRESHOLD ? +process.env.VLM_THRESHOLD : 0.7;
  if (!dry && !apiKey) {
    console.error("❌ Falta la key del VLM (VLM_API_KEY / ANALIZA_API_KEY en .env).");
    process.exit(1);
  }

  const manifest = parseManifest(dir);
  let images = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  if (only.length) images = images.filter((f) => only.some((o) => f.includes(o)));
  console.log(`📂 ${dir}\n   ${images.length} imágenes · ${manifest.size} ids en MANIFEST · modelo ${model} · threshold ${threshold}`);

  if (dry) {
    for (const f of images.slice(0, Number.isFinite(limit) ? limit : images.length)) {
      const m = manifest.get(fileId(f));
      const tag = m ? (m.skip ? `SALTAR (${m.skipReason})` : `g${m.grupo} ${m.kind} → ${m.destino || "?"}`) : "sin metadata";
      console.log(`  ${f}  ·  ${tag}`);
    }
    const skips = images.filter((f) => manifest.get(fileId(f))?.skip).length;
    console.log(`\n   se procesarían ${images.length - skips}, se saltarían ${skips}.`);
    return;
  }

  const out = [];
  const rows = [["archivo", "grupo", "kind", "destino", "articulo", "cantidad", "unidad", "notas", "conf_item", "conf_img", "relevante", "revisar"].join(",")];
  let nItems = 0, nReview = 0, nSkip = 0, nErr = 0, done = 0;

  for (const f of images) {
    if (done >= limit) break;
    const meta = manifest.get(fileId(f));
    if (meta?.skip) {
      nSkip++;
      out.push({ archivo: f, saltado: true, motivo: meta.skipReason, ...meta });
      console.log(`  ⏭️  ${f} — saltado (${meta.skipReason})`);
      continue;
    }
    done++;
    try {
      if (done > 1) await sleep(delay);
      const dataB64 = readFileSync(join(dir, f)).toString("base64");
      const r = await withRetry(() => extractList({ dataB64, mimeType: mime(f), spec: SUPPLY_SPEC, apiKey, model, threshold }));
      nItems += r.items.length;
      if (r.needsReview) nReview++;
      out.push({ archivo: f, grupo: meta?.grupo, kind: meta?.kind, destino: meta?.destino, ...r });
      if (r.items.length === 0) {
        rows.push([csv(f), csv(meta?.grupo), csv(meta?.kind), csv(meta?.destino), "", "", "", csv(r.relevanceNote), "", r.confidence.toFixed(2), r.relevant, "SI"].join(","));
      }
      for (const it of r.items) {
        rows.push([
          csv(f), csv(meta?.grupo), csv(meta?.kind), csv(meta?.destino),
          csv(it.fields.articulo?.value), csv(it.fields.cantidad?.value), csv(it.fields.unidad?.value), csv(it.fields.notas?.value),
          it.confidence.toFixed(2), r.confidence.toFixed(2), r.relevant, r.needsReview ? "SI" : "no",
        ].join(","));
      }
      console.log(`  ✓ ${f} — ${r.items.length} ítems · conf ${r.confidence.toFixed(2)}${r.needsReview ? " · REVISAR" : ""}${r.relevant ? "" : " · no-lista"}`);
    } catch (e) {
      nErr++;
      out.push({ archivo: f, error: e?.message });
      console.log(`  ✗ ${f} — error: ${e?.message}`);
    }
  }

  // Con --only escribe a un archivo aparte para NO pisar el resultado completo.
  const suffix = only.length ? ".only" : "";
  const jsonPath = join(dir, `resultados-vlm${suffix}.json`);
  const csvPath = join(dir, `resultados-vlm${suffix}.csv`);
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  writeFileSync(csvPath, rows.join("\n"));
  console.log(`\n📊 procesadas ${done} · ${nItems} ítems · ${nReview} a revisión · ${nSkip} saltadas · ${nErr} errores`);
  console.log(`   → ${jsonPath}\n   → ${csvPath}`);
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
