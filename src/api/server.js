/* Capa API (LECTURA) + sirve la web. Server-light: solo Node stdlib (node:http).
   Índice/espejo: aquí NO se escribe. La escritura (resolución) va a Supabase desde src/resolucion.
   /api/<curado>  → src/curated/<curado>.json   (panel-vital, servicios, donaciones)
   /api/<bundle>  → data/bundles/<bundle>.json   (output del colector: replicas, centros, ...) */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("../../web", import.meta.url));
const CURATED_DIR = fileURLToPath(new URL("../curated", import.meta.url));
const BUNDLE_DIR = fileURLToPath(new URL("../../data/bundles", import.meta.url));
const PORT = process.env.PORT || 8787;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const CURATED = new Set(["panel-vital", "servicios", "donaciones"]);

async function apiBody(name) {
  if (name === "health") return { ok: true, scaffold: true };
  const file = CURATED.has(name) ? join(CURATED_DIR, `${name}.json`) : join(BUNDLE_DIR, `${name}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  return { items: [], _todo: "TODO(Sx): sin datos aún para esta categoría" };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
    const body = await apiBody(name);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(body));
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

server.listen(PORT, () => console.log(`monitorVE → http://localhost:${PORT}  (api + web)`));
