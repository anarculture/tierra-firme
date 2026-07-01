/* Panel de revisión (OPERADOR, LOCAL). Cierra el loop: borrador (/sitrep → data/sitrep-drafts.json)
   → revisar/editar → publicar a src/curated/sitreps.json (reusa merge de publica-sitrep).
   El servidor PÚBLICO (src/api/server.js) sigue read-only; esto es una herramienta local del operador
   (bind 127.0.0.1). Gate humano = acá se aprueba antes de publicar.
   Auth: por defecto sin auth (local). Si lo vas a tunelizar para revisar desde el teléfono,
   seteá REVISAR_TOKEN: exige HTTP Basic (cualquier usuario, el token como contraseña). */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { merge } from "./publica-sitrep.js";
import { loadLibro, saveLibro, setEstadoManual, vistaNecesidades } from "../src/libro.js";
import { agregarInforme } from "../src/informe.js";

const TOKEN = process.env.REVISAR_TOKEN || "";
/** Sin TOKEN: modo local (true siempre). Con TOKEN: exige Basic con esa contraseña (compare timing-safe). */
function authed(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization || "";
  const raw = h.startsWith("Basic ") ? Buffer.from(h.slice(6), "base64").toString() : "";
  const got = Buffer.from(raw.slice(raw.indexOf(":") + 1)); // todo tras el primer ":" = contraseña
  const exp = Buffer.from(TOKEN);
  return got.length === exp.length && timingSafeEqual(got, exp);
}

const STORE = fileURLToPath(new URL("../src/curated/sitreps.json", import.meta.url));
const DRAFTS = fileURLToPath(new URL("../data/sitrep-drafts.json", import.meta.url));
const WEB = fileURLToPath(new URL("../web", import.meta.url));
const SITE_INFORME = fileURLToPath(new URL("../site/informe.json", import.meta.url));
const PORT = process.env.REVISAR_PORT || 8799;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const key = (it) => `${String(it.titulo ?? "").trim().toLowerCase()}|${String(it.zona ?? "").trim().toLowerCase()}`;

/** Publica los items aprobados (editados) al store y poda los borradores publicados. Puro (sin IO). */
export function applyPublish(store, drafts, items, hoy) {
  const added = merge(store, { items }, hoy); // valida procedencia + dedup; muta store.items
  const pub = new Set(items.map(key));
  const remaining = { ...drafts, items: (drafts.items || []).filter((d) => !pub.has(key(d))) };
  return { added, remaining };
}

const readJson = async (f, def) => (existsSync(f) ? JSON.parse(await readFile(f, "utf8")) : def);

async function main() {
  createServer(async (req, res) => {
    if (!authed(req)) {
      res.writeHead(401, { "www-authenticate": 'Basic realm="revisar"' });
      return res.end("auth requerida (REVISAR_TOKEN)");
    }
    const u = new URL(req.url, `http://${req.headers.host}`);
    // --- Libro interno (issue 01): necesidades + estado derivado, estado manual ---
    if (u.pathname === "/api/libro") {
      const libro = await loadLibro();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ necesidades: vistaNecesidades(libro), compras: libro.compras || [], entregas: libro.entregas || [], grupo: libro.grupo }));
    }
    if (u.pathname === "/api/necesidad/estado" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      let id, estado; try { ({ id, estado } = JSON.parse(body)); } catch {}
      const libro = await loadLibro();
      try {
        setEstadoManual(libro, id, estado === "vigente" ? null : estado); // "vigente" = limpiar el override
        await saveLibro(libro);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ necesidades: vistaNecesidades(libro), compras: libro.compras || [], entregas: libro.entregas || [] }));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: String(e.message) }));
      }
    }
    // --- Informe de compras (issue 04): preview (GET) + publicar con compuerta humana (POST) ---
    if (u.pathname === "/api/informe") {
      const libro = await loadLibro();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(agregarInforme(libro, { fecha: hoyISO() })));
    }
    if (u.pathname === "/api/informe/publicar" && req.method === "POST") {
      const libro = await loadLibro();
      const informe = agregarInforme(libro, { fecha: hoyISO() }); // se re-agrega del libro, no del body: el cliente no inyecta datos
      await writeFile(SITE_INFORME, JSON.stringify(informe, null, 2) + "\n");
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ publicado: true, lineas: informe.lineas.length, total: informe.resumen.total_invertido }));
    }
    if (u.pathname === "/api/drafts") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(await readJson(DRAFTS, { items: [] })));
    }
    if (u.pathname === "/api/publish" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      let items = []; try { items = JSON.parse(body).items || []; } catch {}
      const store = await readJson(STORE, { items: [] });
      const drafts = await readJson(DRAFTS, { items: [] });
      try {
        const { added, remaining } = applyPublish(store, drafts, items, new Date().toISOString().slice(0, 10));
        await writeFile(STORE, JSON.stringify(store, null, 2) + "\n");
        await writeFile(DRAFTS, JSON.stringify(remaining, null, 2) + "\n");
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ added, total: store.items.length }));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: String(e.message) }));
      }
    }
    // superficies públicas (site/): preview local de lo que se deploya a gh-pages (#04/#05)
    if (u.pathname === "/informe.html" || u.pathname === "/informe.json") {
      try {
        const data = await readFile(fileURLToPath(new URL(`../site${u.pathname}`, import.meta.url)));
        res.writeHead(200, { "content-type": MIME[extname(u.pathname)] || "application/octet-stream" });
        return res.end(data);
      } catch { res.writeHead(404); return res.end("404"); }
    }
    // estático desde web/. `/` = panel del Libro (ops+contabilidad); sitrep queda en /revisar.html
    const rel = u.pathname === "/" ? "/libro.html" : u.pathname;
    const file = normalize(join(WEB, rel));
    if (!file.startsWith(WEB)) { res.writeHead(403); return res.end("forbidden"); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end("404"); }
  }).listen(PORT, "127.0.0.1", () => console.log(`revisión (operador, local) → http://127.0.0.1:${PORT}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
