/* Capa API (LECTURA) + sirve la web. Server-light: solo Node stdlib (node:http).
   Índice/espejo: aquí NO se escribe. La escritura (resolución) va a Supabase desde src/resolucion.
   Scaffold: endpoints /api/* devuelven stubs vacíos hasta que el colector los pueble. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("../../web", import.meta.url));
const PORT = process.env.PORT || 8787;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

// TODO(Sx): reemplazar stubs por bundles JSON reales del colector (src/ingest/run.js).
const STUB_API = {
  "/api/health": { ok: true, scaffold: true },
  "/api/replicas": { _todo: "TODO(Sx): contador + pronóstico (SismosVE/USGS)", items: [] },
  "/api/personas": { _todo: "TODO(Sx): búsqueda cross-source + clusters", items: [] },
  "/api/centros": { _todo: "TODO(Sx)", items: [] },
  "/api/refugios": { _todo: "TODO(Sx)", items: [] },
  "/api/donaciones": { _todo: "TODO(Sx)", items: [] },
  "/api/servicios": { _todo: "TODO(Sx): catálogo curado", items: [] },
  "/api/panel-vital": { _todo: "TODO(Sx): contactos de urgencia curados", items: [] }
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const hit = STUB_API[url.pathname];
    res.writeHead(hit ? 200 : 404, { "content-type": "application/json" });
    return res.end(JSON.stringify(hit ?? { error: "not found", _todo: "TODO(Sx)" }));
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

server.listen(PORT, () => console.log(`monitorVE scaffold → http://localhost:${PORT}  (api + web, stubs)`));
