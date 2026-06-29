/* Análisis AUTOMÁTICO: inbox crudo → inteligencia accionable para el ecosistema.
   Hermano de destila.js, pero distinto fin: destila.js produce BORRADORES de
   sitrep (público, verificable); analiza.js produce ANÁLISIS INTERNO — qué se
   necesita y dónde (demanda), qué hay disponible (oferta), gaps de cobertura, y
   alertas (estafas/rumores). No publica nada; alimenta la coordinación.

   Reusa el API de Gemini que ya está configurado en ~/Code/humanitas: Gemini
   expone un endpoint OpenAI-compatible, así que usamos el MISMO protocolo que
   destila.js apuntando ANALIZA_BASE_URL ahí. Reusamos la key, no el cliente.

   Uso:  node scripts/analiza.js [YYYY-MM-DD]
         node scripts/analiza.js --selftest        (lógica pura, sin red)
   Env:  ANALIZA_BASE_URL (def Gemini OpenAI-compat) · ANALIZA_MODEL
         (def gemini-2.5-flash) · ANALIZA_API_KEY (la GEMINI_API_KEY de humanitas)

   ponytail: text-only, como destila.js. La señal en fotos/PDF (listas de insumos)
   no se analiza hasta que haya OCR. Cross-ref de gaps contra centros.json es v2;
   acá los gaps los marca el LLM desde el propio volcado. */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import { parseInbox, buildDump } from "./destila.js";

const ROOT = new URL("..", import.meta.url);
const INBOX = (date) => fileURLToPath(new URL(`ingest/inbox/${date}.jsonl`, ROOT));
const OUT = (date) => fileURLToPath(new URL(`data/analisis-${date}.json`, ROOT));
// Gemini OpenAI-compat por default (reusa la key de humanitas).
const BASE_URL = process.env.ANALIZA_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
const API_KEY = process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY || ""; // VLM_API_KEY = la key nueva con fondos
const MODEL = process.env.ANALIZA_MODEL || "gemini-2.5-flash";
const MAX_TOKENS = +(process.env.ANALIZA_MAX_TOKENS || 16384);
// gemini-2.5-* "piensa" y consume presupuesto de salida; para extracción no hace
// falta. "low" libera tokens y acelera. Vacío = no mandar el param (otros proveedores).
const REASONING = process.env.ANALIZA_REASONING ?? "low";

const SYSTEM = `Analizás un volcado crudo de mensajes de coordinación de crisis (Venezuela, sismo) para extraer INTELIGENCIA accionable. No es un reporte público — es análisis interno para coordinar oferta y demanda de ayuda.

REGLA #1, LA MÁS IMPORTANTE — CERO PII (romperla deja el output inservible):
- PROHIBIDO todo nombre propio de persona, apodo, @usuario, teléfono o contacto, en CUALQUIER campo de la salida.
- Describí a las personas SIEMPRE por ROL + ZONA, nunca por identidad: "un médico en Catia", "una voluntaria", "rescatistas".
- En "ofertas" describí QUÉ se ofrece y EN QUÉ ZONA, jamás QUIÉN. MAL: "Liliana compra insumos" / "camión de Mau". BIEN: "voluntario compra insumos en Caracas" / "transporte disponible en La Guaira".
- "Soy Pedro y tengo camioneta" → la oferta es "transporte (camioneta)", sin "Pedro".
- Nombres de HOSPITALES, REFUGIOS, ZONAS y ORGANIZACIONES SÍ van (no son PII de personas).

Otras reglas DURAS (no se rompen):
- Agrupá por zona. Consolidá reportes repetidos del mismo hecho y contá cuántos mensajes lo mencionan en "reportes".
- Separá DEMANDA (qué se necesita y dónde) de OFERTA (qué hay disponible: dinero, transporte, insumos, voluntarios, sangre).
- urgencia: "alta" (vidas/horas), "media" (días), "baja".
- gaps: zonas o temas con necesidad reportada y SIN oferta/cobertura visible en el volcado.
- alertas: cuentas de donación dudosas, refugios falsos, rumores no confirmados.
- Un dato de una sola fuente igual entra, con reportes=1; la confianza la juzga el operador.
- Si no hay nada accionable, devolvé arrays vacíos.

Salida: respondé SOLO con un objeto json con esta forma exacta, sin texto fuera del json:
{"resumen":"2-3 frases ejecutivas","necesidades":[{"zona":"","lugar":"","items":["..."],"urgencia":"alta|media|baja","reportes":1}],"ofertas":[{"zona":"","ofrece":"","reportes":1}],"gaps":["..."],"alertas":[{"tipo":"estafa|rumor","texto":"","reportes":1}]}`;

const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => (Number.isFinite(+x) && +x > 0 ? Math.floor(+x) : 1);

/** Coacciona la salida cruda del LLM al schema: arrays garantizados, entradas
 *  incompletas descartadas. Nunca tira — el análisis no debe romper por un campo. */
export function normalizar(raw) {
  const r = raw || {};
  return {
    resumen: String(r.resumen || "").trim(),
    necesidades: arr(r.necesidades)
      .filter((n) => n && n.zona && (n.lugar || (Array.isArray(n.items) && n.items.length)))
      .map((n) => ({
        zona: String(n.zona).trim(),
        lugar: String(n.lugar || "").trim(),
        items: arr(n.items).map((i) => String(i).trim()).filter(Boolean),
        urgencia: ["alta", "media", "baja"].includes(n.urgencia) ? n.urgencia : "media",
        reportes: num(n.reportes),
      })),
    ofertas: arr(r.ofertas)
      .filter((o) => o && o.zona && o.ofrece)
      .map((o) => ({ zona: String(o.zona).trim(), ofrece: String(o.ofrece).trim(), reportes: num(o.reportes) })),
    gaps: arr(r.gaps).map((g) => String(g).trim()).filter(Boolean),
    alertas: arr(r.alertas)
      .filter((a) => a && a.texto)
      .map((a) => ({ tipo: a.tipo === "estafa" ? "estafa" : "rumor", texto: String(a.texto).trim(), reportes: num(a.reportes) })),
  };
}

// Palabras que no son nombre de persona aunque aparezcan en un `from` — evitan
// falsos positivos del scan (zonas/roles que SÍ pueden ir en la salida).
const _NO_NOMBRE = new Set(["para", "como", "zona", "esta", "este", "desde", "hasta", "grupo",
  "caracas", "catia", "chacao", "guaira", "vargas", "hospital", "centro", "salud", "cruz"]);

// PII de TERCEROS que el match-contra-remitente NO ve: emails y teléfonos que el LLM cite
// en la salida (p.ej. el titular de una cuenta nombrado en una alerta de estafa — fue la
// fuga real del caso Massieu). Regex stdlib, sin dependencia. Email = PII inequívoca;
// teléfono = ≥10 dígitos para NO marcar fechas (YYYY-MM-DD = 8 díg) ni montos/cantidades.
const _EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const _PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;

/** Red de seguridad del invariante CERO-PII: dado los `from` del inbox (nombres
 *  conocidos) y el texto de salida, devuelve la PII que se coló: nombres de remitente +
 *  emails/teléfonos citados por el LLM (esos no son remitentes; el match por nombre no los
 *  veía). No es NER — tokens de ≥4 letras + regex de email/tel. */
export function piiScan(froms, salida) {
  const raw = String(salida);
  const out = raw.toLowerCase();
  const leaked = new Set();
  for (const f of froms || []) {
    for (const tok of String(f || "").split(/[^a-záéíóúñ]+/i)) {
      const t = tok.toLowerCase();
      if (t.length < 4 || _NO_NOMBRE.has(t)) continue;
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${esc}\\b`).test(out)) leaked.add(tok);
    }
  }
  for (const m of raw.match(_EMAIL_RE) || []) leaked.add(m);
  for (const m of raw.match(_PHONE_RE) || []) {
    if (m.replace(/\D/g, "").length >= 10) leaked.add(m.trim());
  }
  return [...leaked];
  // ponytail: regex atrapa email/teléfono (PII inequívoca, sin dep). Un NOMBRE suelto de
  // tercero sin email/tel asociado sigue pasando — eso pide NER (rompe "sin deps"); techo
  // conocido, subir a NER local solo si los nombres-solos se vuelven un problema real.
}

/** Resumen legible para humanos (consola/operador). Ordena necesidades por urgencia. */
export function formatResumen(a, date) {
  const ORD = { alta: 0, media: 1, baja: 2 };
  const L = [`📊 Análisis del inbox ${date || ""}`.trim(), ""];
  if (a.resumen) L.push(a.resumen, "");
  if (a.necesidades.length) {
    L.push(`🆘 NECESIDADES (${a.necesidades.length}):`);
    for (const n of [...a.necesidades].sort((x, y) => ORD[x.urgencia] - ORD[y.urgencia])) {
      const dst = [n.lugar, n.zona].filter(Boolean).join(", ");
      L.push(`  [${n.urgencia}] ${dst}: ${n.items.join(", ")} ${n.reportes > 1 ? `(${n.reportes} reportes)` : ""}`.trimEnd());
    }
    L.push("");
  }
  if (a.ofertas.length) {
    L.push(`🤝 OFERTAS (${a.ofertas.length}):`);
    for (const o of a.ofertas) L.push(`  ${o.zona}: ${o.ofrece} ${o.reportes > 1 ? `(${o.reportes})` : ""}`.trimEnd());
    L.push("");
  }
  if (a.gaps.length) { L.push(`🕳  GAPS (necesidad sin cobertura):`); for (const g of a.gaps) L.push(`  • ${g}`); L.push(""); }
  if (a.alertas.length) { L.push(`⚠️  ALERTAS (${a.alertas.length}):`); for (const al of a.alertas) L.push(`  [${al.tipo}] ${al.texto}`); L.push(""); }
  if (!a.necesidades.length && !a.ofertas.length && !a.gaps.length && !a.alertas.length) L.push("(nada accionable detectado)");
  return L.join("\n");
}

async function analizar(dump) {
  const headers = { "content-type": "application/json" };
  if (API_KEY) headers.authorization = `Bearer ${API_KEY}`;
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
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
  return normalizar(JSON.parse(text));
}

async function main() {
  const date = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : new Date().toISOString().slice(0, 10);
  const inboxPath = INBOX(date);
  if (!existsSync(inboxPath)) { console.error(`sin inbox para ${date} (${inboxPath})`); process.exit(1); }
  if (!API_KEY) { console.error("falta ANALIZA_API_KEY (la GEMINI_API_KEY de humanitas) — ponela en .env"); process.exit(1); }

  const records = parseInbox(await readFile(inboxPath, "utf8"));
  const { dump, total, conTexto } = buildDump(records);
  if (!dump) { console.error(`inbox ${date}: ${total} mensajes, 0 con texto — nada que analizar`); process.exit(0); }
  if (conTexto < total) console.error(`${total - conTexto} mensaje(s) con media sin texto (voz/foto) — no analizados. TODO: transcribe.py / OCR.`);

  const analisis = await analizar(dump);
  await writeFile(OUT(date), JSON.stringify({ date, ...analisis }, null, 2) + "\n");
  console.log(formatResumen(analisis, date));
  const fugas = piiScan(records.map((r) => r.from), JSON.stringify(analisis));
  if (fugas.length) console.error(`\n⚠ PII detectada en la salida (${fugas.length}): ${fugas.join(", ")} — redactá antes de compartir`);
  console.error(`\n→ data/analisis-${date}.json (${analisis.necesidades.length} necesidades, ${analisis.ofertas.length} ofertas, ${analisis.gaps.length} gaps, ${analisis.alertas.length} alertas)`);
}

function selftest() {
  // normalizar: descarta incompletos, coacciona tipos, garantiza arrays
  const a = normalizar({
    resumen: "  prueba  ",
    necesidades: [
      { zona: "Catia", lugar: "Hospital", items: ["agua", " gasas "], urgencia: "alta", reportes: "3" },
      { zona: "", items: [] },              // sin zona → descartado
      { zona: "Chacao", items: ["sangre"], urgencia: "loquesea", reportes: -5 }, // urgencia inválida→media, reportes→1
    ],
    ofertas: [{ zona: "Chacao", ofrece: "transporte", reportes: 2 }, { zona: "X" }], // 2do sin ofrece → descartado
    gaps: ["Petare sin acopio", "  "],
    alertas: [{ tipo: "estafa", texto: "cuenta dudosa" }, { texto: "" }],
  });
  assert.equal(a.resumen, "prueba");
  assert.equal(a.necesidades.length, 2, "descarta la necesidad sin zona");
  assert.deepEqual(a.necesidades[0].items, ["agua", "gasas"], "trimea items");
  assert.equal(a.necesidades[0].reportes, 3, "coacciona reportes string→int");
  assert.equal(a.necesidades[1].urgencia, "media", "urgencia inválida → media");
  assert.equal(a.necesidades[1].reportes, 1, "reportes negativo → 1");
  assert.equal(a.ofertas.length, 1, "descarta oferta sin 'ofrece'");
  assert.equal(a.gaps.length, 1, "descarta gap vacío");
  assert.equal(a.alertas.length, 1, "descarta alerta sin texto");
  assert.equal(a.alertas[0].tipo, "estafa");

  // formatResumen: ordena por urgencia y no rompe con análisis vacío
  const txt = formatResumen(a, "2026-06-26");
  assert.ok(txt.includes("NECESIDADES") && txt.includes("Hospital, Catia"), txt);
  assert.ok(formatResumen(normalizar({}), "x").includes("nada accionable"));

  // piiScan: atrapa nombre de remitente colado en la salida; ignora cortos/comunes
  assert.deepEqual(piiScan(["Liliana", "Augusto Gerardi"], "oferta: liliana compra insumos"), ["Liliana"]);
  assert.deepEqual(piiScan(["Anghy Rondón-García"], "gasolina donada por anghy en caracas"), ["Anghy"]);
  assert.deepEqual(piiScan(["Ana"], "un voluntario en la zona"), [], "nombre de 3 letras → ignorado");
  assert.deepEqual(piiScan(["Rodrigo Ara"], "transporte disponible en Caracas"), [], "sin fuga → vacío");
  // piiScan: emails/teléfonos de TERCEROS (no remitentes) — la fuga real que el match por
  // nombre no veía (caso Massieu). Email siempre; teléfono ≥10 díg (no marca fechas ni montos).
  assert.deepEqual(piiScan([], "alerta estafa: cuenta dudosa emile@gmail.com / titular"), ["emile@gmail.com"]);
  assert.deepEqual(piiScan([], "contacto +58 412-7030773 recibe"), ["+58 412-7030773"]);
  assert.deepEqual(piiScan([], '{"date":"2026-06-29","items":["200 litros agua"]}'), [], "fecha 8 díg / monto ≠ teléfono");
  console.log("selftest OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest();
  else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
