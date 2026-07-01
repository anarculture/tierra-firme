/* Capa API (LECTURA) + sirve la web. Server-light: solo Node stdlib (node:http).
   Índice/espejo: aquí NO se escribe. La escritura (resolución) va a Supabase desde src/resolucion.
   /api/<curado>  → src/curated/<curado>.json   (panel-vital, servicios, donaciones)
   /api/<bundle>  → data/bundles/<bundle>.json   (output del colector: replicas, centros, ...) */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { serveBody } from "./pii-gate.js";

// El server público sirve el bundle público (site/): lista recortada #05 + informe #04.
// El panel del operador vive aparte en scripts/revisar-server.js (sirve web/).
const WEB_ROOT = fileURLToPath(new URL("../../site", import.meta.url));
const CURATED_DIR = fileURLToPath(new URL("../curated", import.meta.url));
const BUNDLE_DIR = fileURLToPath(new URL("../../data/bundles", import.meta.url));
const PORT = process.env.PORT || 8787;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

// Lee .env (stdlib, sin dep). Solo se EXPONE la URL + publishable key (públicas); la secret NO sale al navegador.
function loadEnv() {
  const f = fileURLToPath(new URL("../../.env", import.meta.url));
  if (!existsSync(f)) return {};
  const out = {};
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const ENV = { ...loadEnv(), ...process.env };

async function apiBody(name) {
  if (name === "health") return { ok: true, scaffold: true };
  if (name === "config") return { supabaseUrl: ENV.SUPABASE_URL || "", supabasePublishableKey: ENV.SUPABASE_PUBLISHABLE_KEY || "" };
  // Curado primero (src/curated/<name>.json), luego bundle del colector (data/bundles/<name>.json).
  for (const dir of [CURATED_DIR, BUNDLE_DIR]) {
    const file = join(dir, `${name}.json`);
    if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  }
  return { items: [], _todo: "TODO(Sx): sin datos aún para esta categoría" };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "").toLowerCase(); // lower: /api/Personas no evade el gate PII
    const body = await apiBody(name);
    // Gate PII: bundles de personas se redactan salvo canal gateado (TF_API_KEY). Regla §5, no-negociable.
    const out = serveBody(name, body, req.headers["x-api-key"] || url.searchParams.get("key"), ENV.TF_API_KEY);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(out));
  }
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = normalize(join(WEB_ROOT, rel));
  if (!file.startsWith(WEB_ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<h1>404</h1>");
  }
});

server.listen(PORT, () => console.log(`Tierra Firme → http://localhost:${PORT}  (api + web)`));
