/* Inventario de faltantes por hospital — el sensor de demanda, ATRIBUIDO.

   Cada hospital manda por WhatsApp lo que se le está agotando (foto del papel /
   voz / texto). El buzón lo guarda en el inbox (mismo contrato que todo). Este
   script filtra los mensajes de hospitales conocidos (data/hospitales.json:
   phone→hospital), extrae los ítems faltantes reusando el destilador de
   destila.js, y mantiene un estado VIVO por hospital: el último reporte de cada
   ítem gana (=actualizado), con marca de frescura.

   Menor margen de error = el eco de confirmación (ingest/reply.py) le muestra al
   hospital lo que se entendió, atribuido a su nombre; si está mal, reenvía el
   dato corregido y el último gana. No hay que aprender formato nuevo.

   NO publica solo — es captura interna; el humano verifica antes de cualquier
   salida pública (regla no negociable del repo).

   Uso:  node scripts/inventario.js [YYYY-MM-DD]
         node scripts/inventario.js --selftest    (lógica pura, sin red)
   Env:  TF_STALE_HORAS (def 24) — horas tras las que un faltante se marca viejo.
         VLM_API_KEY | ANALIZA_API_KEY | DESTILA_API_KEY (la GEMINI de humanitas).

   ponytail: reusa destilar() de destila.js (mismo modelo/key/prompt) llamándolo
   POR MENSAJE para conservar la atribución al hospital. N llamadas/día = bajo
   volumen (solo faltantes críticos); si sube, batch por hospital. */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import { parseInbox, destilar } from "./destila.js";

const ROOT = new URL("..", import.meta.url);
const INBOX = (d) => fileURLToPath(new URL(`ingest/inbox/${d}.jsonl`, ROOT));
const HOSP = fileURLToPath(new URL("data/hospitales.json", ROOT));
const OUT = fileURLToPath(new URL("data/inventario-faltantes.json", ROOT));
const STALE_H = Number(process.env.TF_STALE_HORAS) || 24;

const normPhone = (s) => String(s || "").replace(/\D/g, "");
const normItem = (s) => String(s || "").trim().toLowerCase();

/** {phone: {nombre,estado,municipio}} → Map(phoneNormalizado → hospital).
 *  Salta claves "_comment" del ejemplo y entradas sin nombre. */
export function loadHospitales(json) {
  const map = new Map();
  for (const [phone, h] of Object.entries(json || {})) {
    if (phone.startsWith("_") || !h || !h.nombre) continue;
    map.set(normPhone(phone), h);
  }
  return map;
}

/** Mete/actualiza los ítems de UN reporte en el estado. El ts más nuevo por ítem
 *  gana (inventario vivo); un reporte más viejo solo suma al contador. Muta y
 *  devuelve state. ts = ISO del mensaje (compara lexicográfico, todo en Z). */
export function upsert(state, hosp, items, ts) {
  const H = (state.hospitales[hosp.nombre] ||= {
    estado: hosp.estado || "", municipio: hosp.municipio || "", faltantes: {},
  });
  for (const it of items) {
    const nombre = it.nombreArticulo || it.titulo;
    if (!nombre) continue;
    const k = normItem(nombre);
    const prev = H.faltantes[k];
    if (prev && prev.ts > ts) { prev.reportes++; continue; } // llegó uno más viejo
    H.faltantes[k] = {
      articulo: String(nombre).trim(),
      cantidad: String(it.cantidad || "").trim(),
      urgencia: ["critica", "alta", "media", "baja"].includes(it.urgencia) ? it.urgencia : "media",
      ts,
      reportes: (prev?.reportes || 0) + 1,
    };
  }
  return state;
}

/** Marca `viejo:true` en cada faltante cuyo ts supere staleH horas antes de now (ms). */
export function marcarFrescura(state, now, staleH = STALE_H) {
  const limite = now - staleH * 3600e3;
  for (const H of Object.values(state.hospitales)) {
    for (const f of Object.values(H.faltantes)) f.viejo = Date.parse(f.ts) < limite;
  }
  return state;
}

async function main() {
  const date = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2] : new Date().toISOString().slice(0, 10);
  if (!(process.env.DESTILA_API_KEY || process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY)) {
    console.error("falta VLM_API_KEY / ANALIZA_API_KEY (la GEMINI de humanitas) — ponela en .env"); process.exit(1);
  }
  if (!existsSync(HOSP)) {
    console.error(`falta ${HOSP} — copia data/hospitales.example.json a data/hospitales.json y llénalo`); process.exit(1);
  }
  const inboxPath = INBOX(date);
  if (!existsSync(inboxPath)) { console.error(`sin inbox para ${date} (${inboxPath})`); process.exit(1); }

  const hospitales = loadHospitales(JSON.parse(await readFile(HOSP, "utf8")));
  const records = parseInbox(await readFile(inboxPath, "utf8"));
  const state = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : { hospitales: {} };
  if (!state.hospitales) state.hospitales = {};

  let procesados = 0, sinTexto = 0, ajenos = 0;
  for (const r of records) {
    const h = hospitales.get(normPhone(r.from));
    if (!h) { ajenos++; continue; }                       // no es un hospital registrado
    if (!r.text || !String(r.text).trim()) { sinTexto++; continue; } // media sin texto: procesa la media primero
    const items = await destilar(String(r.text));
    upsert(state, h, items, r.ts || new Date().toISOString());
    procesados++;
  }
  marcarFrescura(state, Date.now());
  state.generado = new Date().toISOString();
  await writeFile(OUT, JSON.stringify(state, null, 2) + "\n");
  const nH = Object.keys(state.hospitales).length;
  console.log(`inventario ${date}: ${procesados} reporte(s) de hospital · ${sinTexto} media sin texto · ${ajenos} de no-hospitales → data/inventario-faltantes.json (${nH} hospital(es))`);
}

async function selftest() {
  const map = loadHospitales({ _comment: "x", "58414-000-1122": { nombre: "Hosp A", estado: "Zulia" }, "999": {} });
  assert.equal(map.size, 1, "salta _comment y entradas sin nombre");
  assert.ok(map.get("584140001122"), "normaliza phone a solo dígitos");

  const st = { hospitales: {} };
  const h = { nombre: "Hosp A", estado: "Zulia" };
  upsert(st, h, [{ nombreArticulo: "Suero", cantidad: "quedan 10", urgencia: "critica" }], "2026-07-01T10:00:00Z");
  let f = () => st.hospitales["Hosp A"].faltantes["suero"];
  assert.equal(f().cantidad, "quedan 10");
  assert.equal(f().reportes, 1);
  // reporte más NUEVO del mismo ítem → pisa (inventario actualizado)
  upsert(st, h, [{ nombreArticulo: "suero", cantidad: "quedan 3", urgencia: "critica" }], "2026-07-01T11:00:00Z");
  assert.equal(f().cantidad, "quedan 3", "último ts gana");
  assert.equal(f().reportes, 2, "cuenta acumulada");
  // reporte más VIEJO → NO pisa, solo suma
  upsert(st, h, [{ nombreArticulo: "suero", cantidad: "quedan 99", urgencia: "baja" }], "2026-07-01T09:00:00Z");
  assert.equal(f().cantidad, "quedan 3", "un reporte viejo no pisa el vivo");
  assert.equal(f().reportes, 3);
  // fallback nombreArticulo ausente → usa titulo
  upsert(st, h, [{ titulo: "Gasas", cantidad: "" }], "2026-07-01T12:00:00Z");
  assert.ok(st.hospitales["Hosp A"].faltantes["gasas"], "titulo cubre cuando falta nombreArticulo");
  // frescura: ts viejo se marca, reciente no
  marcarFrescura(st, Date.parse("2026-07-03T11:00:00Z"), 24);
  assert.equal(f().viejo, true, "48h > 24h → viejo");
  marcarFrescura(st, Date.parse("2026-07-01T12:00:00Z"), 24);
  assert.equal(f().viejo, false);
  console.log("selftest OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
  else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
