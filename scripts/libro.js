/* CLI del Libro (operador). Intake de Necesidades al libro interno + estados manuales.
   Dos entradas: JSON destilado (offline, determinista) y texto crudo vía LLM (Gemini,
   mismo protocolo OpenAI-compat que destila.js). El estado NO se teclea: se deriva
   (ADR 0005). El operador solo setea cancelada/por_decidir.

   Uso:
     node scripts/libro.js ls                          # lista necesidades + estado derivado
     node scripts/libro.js add-json '<json|[json]>'    # ingesta mención(es) destilada(s) (offline)
     node scripts/libro.js destila [YYYY-MM-DD]        # inbox texto → necesidades (LLM)
     node scripts/libro.js estado <id> <cancelada|por_decidir|vigente>
     node scripts/libro.js --selftest                  # lógica de ingesta, sin red
   Env: DESTILA_API_KEY|VLM_API_KEY|ANALIZA_API_KEY · LIBRO_DESTILA_MODEL (def gemini-2.5-flash-lite) */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import { loadLibro, saveLibro, ingestNecesidad, ingestCompra, ligarCompra, ingestEntrega, ligarEntrega, setEstadoManual, vistaNecesidades, derivarEstado } from "../src/libro.js";
import { parseInbox, buildDump } from "./destila.js";
import { fotoANecesidades, fotoAFactura, ingestaFotoNecesidades, ingestaFotoFactura } from "../src/foto-libro.js";
import { clasificar, rutear } from "../src/clasifica.js";

const ROOT = new URL("..", import.meta.url);
const INBOX = (date) => fileURLToPath(new URL(`ingest/inbox/${date}.jsonl`, ROOT));
const BASE_URL = process.env.DESTILA_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
const API_KEY = process.env.DESTILA_API_KEY || process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY || "";
const MODEL = process.env.LIBRO_DESTILA_MODEL || "gemini-2.5-flash-lite";

const SYSTEM = `Destilás un volcado crudo de mensajes de crisis (Venezuela, sismo) en NECESIDADES para el libro interno de un Grupo de apoyo. Una necesidad = falta un insumo en un lugar (Destino).

Por cada necesidad extraé:
- destino.nombre: el lugar concreto normalizado (p.ej. "Hospital Pérez Carreño", "Punto de apoyo Catia").
- destino.tipo: uno de [hospital, punto_apoyo, centro_acopio, doctor, persona, otro].
- destino.zona: parroquia/municipio/estado si se dice; si no, "".
- insumo: el item concreto que hace falta (p.ej. "gasas", "agua potable", "pañales talla M").
- cantidad: número + unidad si el mensaje lo dice (p.ej. "200 unidades"); si no, null.
- urgencia: uno de [critica, alta, media, baja]; ante la duda, media.

Reglas DURAS:
- Un registro por (destino, insumo). NO inventes datos: ante la duda cantidad=null, urgencia="media".
- Si un mensaje es solo "busco a una persona" o ruido, omitilo (no es una necesidad de insumos).
- Respondé SOLO con json de esta forma exacta: {"necesidades":[{"destino":{"nombre":"","tipo":"","zona":""},"insumo":"","cantidad":null,"urgencia":""}]}`;

async function destilarTexto(dump) {
  if (!API_KEY) throw new Error("falta DESTILA_API_KEY / VLM_API_KEY / ANALIZA_API_KEY en .env");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL, max_tokens: 8192, reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: dump }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const text = (await res.json()).choices?.[0]?.message?.content;
  if (!text) throw new Error("respuesta del LLM sin contenido");
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.necesidades) ? parsed.necesidades : [];
}

/** Aplica menciones (destiladas) al libro. Puro salvo por mutar libro. Devuelve conteos. */
export function aplicarMenciones(libro, menciones) {
  let nuevas = 0, dedup = 0;
  for (const m of menciones) {
    const { accion } = ingestNecesidad(libro, m);
    if (accion === "nueva") nuevas++; else dedup++;
  }
  return { nuevas, dedup };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const libro = await loadLibro();

  if (cmd === "ls" || !cmd) {
    const v = vistaNecesidades(libro);
    if (!v.length) return console.log("libro vacío. Ingresá con: node scripts/libro.js add-json '<json>'  |  destila <fecha>");
    for (const n of v) console.log(`${n.estado.padEnd(11)} r${n.reportes}  ${n.insumo} → ${n.destino.nombre} (${n.destino.zona || "?"})  [${n.id}]`);
    return;
  }
  if (cmd === "add-json") {
    const parsed = JSON.parse(rest.join(" "));
    const menciones = Array.isArray(parsed) ? parsed : [parsed];
    const { nuevas, dedup } = aplicarMenciones(libro, menciones);
    await saveLibro(libro);
    return console.log(`+${nuevas} nueva(s), ${dedup} dedup → data/libro.json (total: ${libro.necesidades.length})`);
  }
  if (cmd === "destila") {
    const date = rest[0] || new Date().toISOString().slice(0, 10);
    const path = INBOX(date);
    if (!existsSync(path)) { console.error(`sin inbox para ${date} (${path})`); process.exit(1); }
    const { dump, conTexto } = buildDump(parseInbox(await readFile(path, "utf8")));
    if (!dump) { console.error(`inbox ${date}: 0 mensajes con texto`); process.exit(0); }
    const menciones = await destilarTexto(dump);
    const { nuevas, dedup } = aplicarMenciones(libro, menciones);
    await saveLibro(libro);
    return console.log(`destilado ${conTexto} mensaje(s) → +${nuevas} necesidad(es), ${dedup} dedup → data/libro.json`);
  }
  if (cmd === "add-compra") {
    const c = ingestCompra(libro, JSON.parse(rest.join(" ")));
    await saveLibro(libro);
    return console.log(`compra ${c.id}: ${c.items.length} línea(s), total ${c.costo_total}${c.necesidad_id ? ` → liga ${c.necesidad_id}` : " (suelta)"}`);
  }
  if (cmd === "ligar") {
    const [compraId, necesidadId] = rest;
    ligarCompra(libro, compraId, necesidadId);
    await saveLibro(libro);
    const nec = libro.necesidades.find((n) => n.id === necesidadId);
    return console.log(`${compraId} ligada a ${necesidadId} → ${derivarEstado(nec, libro)}`);
  }
  if (cmd === "clasifica") {
    const c = await clasificar(rest.join(" "));
    const r = rutear(libro, c);
    if (r.accion === "desambiguar") console.log(`🤖 ${r.pregunta}\n   (responde: node scripts/libro.js desambigua ${r.necesidad.id} "<lo mismo|más>")`);
    else console.log(`[${c.categoria}] → ${r.accion}${r.necesidad ? ` (${r.necesidad.id})` : ""}`);
    if (r.accion !== "desambiguar" && r.accion !== "ignorar") await saveLibro(libro);
    return;
  }
  if (cmd === "desambigua") {
    const { resolverDesambiguacion } = await import("../src/clasifica.js");
    const [id, ...resp] = rest;
    const r = resolverDesambiguacion(libro, id, resp.join(" "));
    await saveLibro(libro);
    return console.log(`${id} → ${r.accion} (reportes ${r.necesidad.reportes}, cantidad ${r.necesidad.cantidad ?? "—"})`);
  }
  if (cmd === "foto-necesidad") {
    const [path, ...destinoJson] = rest;
    const destino = destinoJson.length ? JSON.parse(destinoJson.join(" ")) : { nombre: "Por ubicar (revisar)", tipo: "otro", zona: "" };
    const { menciones } = await fotoANecesidades(path, destino);
    const necs = ingestaFotoNecesidades(libro, menciones);
    await saveLibro(libro);
    return console.log(`foto → ${necs.length} necesidad(es) para ${destino.nombre}: ${necs.map((n) => n.insumo).join(", ")}`);
  }
  if (cmd === "foto-factura") {
    const [path, ...opt] = rest;
    const { compra } = await fotoAFactura(path, opt.length ? JSON.parse(opt.join(" ")) : {});
    const c = ingestaFotoFactura(libro, compra);
    await saveLibro(libro);
    return console.log(`factura → compra ${c.id}: ${c.items.length} línea(s), total ${c.costo_total}, adjunto ${c.factura}`);
  }
  if (cmd === "add-entrega") {
    const e = ingestEntrega(libro, JSON.parse(rest.join(" ")));
    await saveLibro(libro);
    return console.log(`entrega ${e.id} → ${typeof e.destino === "string" ? e.destino : e.destino?.nombre || "?"}${e.foto ? " 📷" : ""}${e.necesidad_id ? ` · liga ${e.necesidad_id}` : ""}`);
  }
  if (cmd === "ligar-entrega") {
    const [entregaId, necesidadId] = rest;
    ligarEntrega(libro, entregaId, necesidadId);
    await saveLibro(libro);
    const nec = libro.necesidades.find((n) => n.id === necesidadId);
    return console.log(`${entregaId} ligada a ${necesidadId} → ${derivarEstado(nec, libro)}`);
  }
  if (cmd === "estado") {
    const [id, estado] = rest;
    setEstadoManual(libro, id, estado === "vigente" ? null : estado);
    await saveLibro(libro);
    const nec = libro.necesidades.find((n) => n.id === id);
    return console.log(`${id} → ${derivarEstado(nec, libro)}`);
  }
  console.error(`comando desconocido: ${cmd}. Ver: node scripts/libro.js --selftest`);
  process.exit(1);
}

function selftest() {
  const { emptyLibro } = { emptyLibro: () => ({ grupo: "default", necesidades: [], compras: [], entregas: [] }) };
  const l = emptyLibro();
  const r = aplicarMenciones(l, [
    { destino: { nombre: "Pérez Carreño", tipo: "hospital", zona: "Caracas" }, insumo: "gasas", urgencia: "alta" },
    { destino: { nombre: "perez carreno", tipo: "hospital" }, insumo: "Gasas" }, // dedup (misma clave normalizada)
    { destino: { nombre: "Vargas", tipo: "hospital" }, insumo: "agua" },
  ]);
  assert.equal(r.nuevas, 2, "dos destinos+insumos distintos");
  assert.equal(r.dedup, 1, "la variante de escritura dedupa");
  assert.equal(l.necesidades.find((n) => n.insumo === "gasas").reportes, 2);
  console.log("selftest OK");
}

if (process.argv.includes("--selftest")) selftest();
else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
