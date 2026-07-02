/* Destilación AUTOMÁTICA: inbox crudo → borradores de sitrep.
   Cierra el paso que antes hacía un humano con /sitrep a mano. Lee
   ingest/inbox/<fecha>.jsonl (records {ts,from,kind,text,media}), llama a Gemini
   (gemini-2.5-flash-lite vía su endpoint OpenAI-compatible — reusa la key de
   humanitas, MISMO protocolo que analiza.js). Escribe a data/sitrep-drafts.json
   en el schema que merge() espera. El operador revisa/aprueba en `npm run revisar`
   antes de publicar. NO publica solo. El contenido del inbox (PII potencial) sale
   a Gemini; el gate humano del panel atrapa errores. Para PII estricta, apuntá
   DESTILA_BASE_URL/MODEL a un modelo propio (mismo protocolo OpenAI-compat).

   Uso:  node scripts/destila.js [YYYY-MM-DD]
         node scripts/destila.js --selftest         (prueba lógica pura, sin red)
   Env:  DESTILA_API_KEY | ANALIZA_API_KEY (la GEMINI_API_KEY de humanitas) ·
         DESTILA_MODEL (def gemini-2.5-flash-lite) · DESTILA_BASE_URL (def Gemini
         OpenAI-compat) · DESTILA_REASONING (def low)

   ponytail: text-only MVP. Voz (.ogg) y fotos quedan en el inbox sin destilar —
   corré transcribe.py primero / TODO: bajar caption+OCR de media. */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert";
import { geocode } from "../src/ingest/geocoder.js";

const ROOT = new URL("..", import.meta.url);
const INBOX = (date) => fileURLToPath(new URL(`ingest/inbox/${date}.jsonl`, ROOT));
const DRAFTS = fileURLToPath(new URL("data/sitrep-drafts.json", ROOT));
const CACHE = fileURLToPath(new URL("data/geocode-cache.json", ROOT));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE_URL = process.env.DESTILA_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai"; // Gemini OpenAI-compat
const API_KEY = process.env.DESTILA_API_KEY || process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY || ""; // VLM_API_KEY = key nueva con fondos
const MODEL = process.env.DESTILA_MODEL || "gemini-2.5-flash-lite";
// gemini-2.5-* "piensa" y consume presupuesto de salida; para extracción no hace falta. "low" libera tokens.
const REASONING = process.env.DESTILA_REASONING ?? "low";

const key = (it) => `${String(it.titulo ?? "").trim().toLowerCase()}|${String(it.zona ?? "").trim().toLowerCase()}`;

// ponytail: enum de categoría/urgencia = mejor estimación del esquema de ayudaencamino,
// SIN confirmar contra su API real. Al cablear el export (paso 4 del MVP) confirmá el
// vocabulario contra su /api/organizations y ajustá esta lista si difiere.
const SYSTEM = `Destilás un volcado crudo de mensajes de crisis (Venezuela, sismo) en borradores de reporte de situación (sitrep) para verificación humana. Producís BORRADORES; un humano verifica y publica. NUNCA auto-amplifiques.

Reglas DURAS (no se rompen):
- CERO PII en la salida: sin nombres, teléfonos ni ubicación de personas vivas. Las personas buscadas/localizadas NO van acá (van a un índice privado aparte). Si un mensaje es solo "busco a X", omitilo.
- Agrupá por zona. Un item por hecho/necesidad por zona.
- Procedencia obligatoria: fuenteOrigen describe el ORIGEN sin PII (p.ej. "Reporte ciudadano vía WhatsApp", "Varios reportes ciudadanos"). Nunca el nombre del reportante.
- Verificación: si un dato viene de UNA sola fuente o sin confirmar, empezá el texto con "⏳ sin confirmar:". Solo marcá como hecho lo confirmado por 2+ reportes independientes.
- Rumores/estafas (cuentas de donación dudosas, refugios falsos): incluilos con texto empezando en "⚠ rumor sin verificar:".
- titulo: corto y concreto. texto: legible, una pantalla de teléfono. Si no hay nada destilable, devolvé items vacío.

Demanda estructurada (para alimentar la plataforma de coordinación de ayuda):
- Si el item es una NECESIDAD (falta algo en un lugar), además del texto extraé estos campos:
  · categoria: uno de [medicinas, higiene, alimentos, agua, herramientas, ropa, pernocta, otro].
  · urgencia: uno de [critica, alta, media, baja].
  · nombreArticulo: el item concreto que hace falta (p.ej. "agua potable", "pañales talla M", "colchonetas").
  · cantidad: número + unidad si el mensaje lo dice (p.ej. "200 litros", "50 unidades"); si no se dice, "".
  · direccion: punto/dirección exacta si el mensaje la da (refugio, edificio, calle); si solo hay zona, "".
- Si el item NO es una necesidad (alerta, rumor), omití esos 5 campos. NUNCA inventes un valor; ante la duda dejá "" (cantidad/direccion) o el más conservador (urgencia: baja).

Salida: respondé SOLO con un objeto json con esta forma exacta, sin texto fuera del json. Los 5 campos de demanda solo aparecen en items de necesidad:
{"items":[{"titulo":"...","texto":"...","zona":"...","fuenteOrigen":"...","categoria":"...","urgencia":"...","nombreArticulo":"...","cantidad":"...","direccion":"..."}]}`;

/** Parsea inbox JSONL → records. Líneas vacías o corruptas se saltan. */
export function parseInbox(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/** Arma el volcado para el LLM con los records que tienen texto. Devuelve
 *  {dump, total, conTexto} para reportar cuántos quedaron sin destilar (media). */
export function buildDump(records) {
  const conTexto = records.filter((r) => r.text && String(r.text).trim());
  const dump = conTexto
    .map((r) => `[${String(r.ts || "").slice(11, 16)} ${r.from || "anon"}] ${r.text}`)
    .join("\n");
  return { dump, total: records.length, conTexto: conTexto.length };
}

/** Mezcla items nuevos en los borradores existentes (dedup por titulo|zona).
 *  No clobberea lo que el operador ya editó/dejó pendiente. Devuelve {items, added}. */
export function mergeDrafts(existing, fresh) {
  const items = [...(existing.items || [])];
  const seen = new Set(items.map(key));
  let added = 0;
  for (const it of fresh) {
    if (!it.titulo || !it.texto || !it.fuenteOrigen) continue; // merge() los exige luego
    if (seen.has(key(it))) continue;
    items.push(it);
    seen.add(key(it));
    added++;
  }
  return { items, added };
}

async function destilar(dump) {
  const headers = { "content-type": "application/json" };
  if (API_KEY) headers.authorization = `Bearer ${API_KEY}`;
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      ...(REASONING ? { reasoning_effort: REASONING } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: dump },
      ],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") console.error("⚠ salida truncada (max_tokens) — subí max_tokens o partí el inbox");
  const text = choice?.message?.content;
  if (!text) throw new Error("respuesta sin contenido");
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error(`salida del LLM no es JSON válido: ${text.slice(0, 200)}`); }
  return Array.isArray(parsed.items) ? parsed.items : [];
}

/** Geocode = el paso del medio del loop (destila→geocode→revisar). Adjunta coords a
 *  cada borrador por su zona, para que el panel/torre de control lo ubique. Cascada
 *  OFFLINE por default (cache → centroide de estado, instantáneo, determinista); pega
 *  a Nominatim solo si GEOCODE_NOMINATIM=1. Muta items, persiste el cache compartido. */
export async function geocodeDrafts(items, cacheFile = CACHE) {
  let cache = {};
  try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* sin cache previa */ }
  const state = { networkDown: process.env.GEOCODE_NOMINATIM !== "1", calledNominatim: false };
  for (const it of items) {
    if (it.coords || !it.zona) continue;
    state.calledNominatim = false;
    // zona libre (parroquia/ciudad/estado) → la pasamos como estado y municipio.
    it.coords = await geocode(null, it.zona, it.zona, cache, { state });
    if (state.calledNominatim) await sleep(1000); // ToS Nominatim: máx 1 req/s
  }
  try { await writeFile(cacheFile, JSON.stringify(cache, null, 2)); } catch { /* best-effort */ }
  return items;
}

async function main() {
  const date = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : new Date().toISOString().slice(0, 10);
  const inboxPath = INBOX(date);
  if (!existsSync(inboxPath)) { console.error(`sin inbox para ${date} (${inboxPath})`); process.exit(1); }
  if (!API_KEY) { console.error("falta DESTILA_API_KEY / ANALIZA_API_KEY (la GEMINI_API_KEY de humanitas) — ponela en .env"); process.exit(1); }

  const records = parseInbox(await readFile(inboxPath, "utf8"));
  const { dump, total, conTexto } = buildDump(records);
  if (!dump) { console.error(`inbox ${date}: ${total} mensajes, 0 con texto — nada que destilar`); process.exit(0); }
  if (conTexto < total) console.error(`${total - conTexto} mensaje(s) con media sin texto (voz/foto) — no destilados. TODO: transcribe.py / OCR.`);

  const fresh = await destilar(dump);
  await geocodeDrafts(fresh); // adjunta coords por zona (offline por default)
  const existing = existsSync(DRAFTS) ? JSON.parse(await readFile(DRAFTS, "utf8")) : { items: [] };
  const { items, added } = mergeDrafts(existing, fresh);
  await writeFile(DRAFTS, JSON.stringify({ items }, null, 2) + "\n");
  console.log(`destilados ${added} borrador(es) nuevo(s) de ${conTexto} mensaje(s) → data/sitrep-drafts.json (total: ${items.length}). Revisá: npm run revisar`);
}

async function selftest() {
  const recs = parseInbox(
    '{"ts":"2026-06-26T08:01:00Z","from":"Ana","kind":"text","text":"Sin agua en Catia hace 3 días"}\n' +
    'línea corrupta no-json\n' +
    '{"ts":"2026-06-26T08:05:00Z","from":"Luis","kind":"voice","media":"x.ogg"}\n'
  );
  assert.equal(recs.length, 2, "parseInbox debe saltar líneas corruptas, no media-only");
  const { dump, total, conTexto } = buildDump(recs);
  assert.equal(total, 2);
  assert.equal(conTexto, 1, "buildDump filtra los sin-texto (voz)");
  assert.ok(dump.includes("Catia") && !dump.includes("x.ogg"));

  const base = { items: [{ titulo: "Sin agua", zona: "Catia", texto: "...", fuenteOrigen: "Reporte ciudadano" }] };
  const m = mergeDrafts(base, [
    { titulo: "sin agua", zona: "CATIA", texto: "dup", fuenteOrigen: "x" },   // dup (case-insensitive)
    { titulo: "Falta agua", zona: "Catia", texto: "nuevo", fuenteOrigen: "Varios reportes",
      categoria: "agua", urgencia: "critica", nombreArticulo: "agua potable" }, // necesidad con demanda estructurada
    { titulo: "incompleto", zona: "Catia", texto: "" },                        // sin texto → descartado
  ]);
  assert.equal(m.added, 1, "solo el item nuevo y completo se agrega");
  assert.equal(m.items.length, 2);
  const need = m.items.find((i) => i.titulo === "Falta agua");
  assert.equal(need.categoria, "agua", "los campos de demanda sobreviven el merge (los consume el export)");

  // geocode offline (sin red): zona = estado conocido → centroide; desconocida → null.
  const tmpCache = join(tmpdir(), "tf-destila-selftest-cache.json");
  const [g1, g2] = await geocodeDrafts(
    [{ titulo: "a", texto: "b", fuenteOrigen: "c", zona: "Miranda" },
     { titulo: "d", texto: "e", fuenteOrigen: "f", zona: "Narnia" }],
    tmpCache,
  );
  assert.ok(g1.coords && typeof g1.coords.lat === "number", "zona estado conocido → coords");
  assert.equal(g1.coords.source, "estado");
  assert.equal(g2.coords, null, "zona desconocida → null (no inventa ubicación)");
  console.log("selftest OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
  else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
