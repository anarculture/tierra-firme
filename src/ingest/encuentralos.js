/* Fuente: Encuéntralos (encuentralos.tecnosoft.dev/api/personas) — AGREGADOR de personas
   desaparecidas/encontradas del sismo. Federa Reconexión (origen dominante) + VenezuelaTeBusca
   + apps Supabase (visible por el host de la foto). ~107k y crece. Read-only.
   API JSON limpia: ?limit=100&offset=N (máx 100/página) · ?q=<término> busca nombre+cédula.
   ⚠️ PII: descarta SIEMPRE el contacto del reportante (reporta_contacto, pv_por, pv_contacto,
   pv_lugar, pv_salud, pv_relacion). Conserva nombre/cédula para dedup INTERNO — el bundle es
   interno, se gatea/redacta al servir (nunca crudo a una familia).
   ⚠️ SIN licencia declarada → captura INTERNA; NO publicar en /v1. */
const BASE = "https://encuentralos.tecnosoft.dev/api/personas";
const PAGE = 100; // máx que acepta la API (limit>100 igual devuelve 100)
const num = (v) => (v == null || v === "" ? null : Number(v));

// status de búsqueda → enum estable (mismo criterio que el parser de VZLA_DEDUP)
const STATUS = {
  desaparecido: "missing", desaparecida: "missing",
  encontrado: "found", encontrada: "found",
  herido: "injured", herida: "injured",
  fallecido: "deceased", fallecida: "deceased",
};

/** @param {any[]} items @returns {import("../model/index.js").Registro[]} */
export function normalize(items) {
  return (items ?? []).map((r) => {
    const lat = num(r.ultima_lat), lng = num(r.ultima_lng);
    return {
      sourceId: "encuentralos",
      categoria: "persona",
      payload: {
        id: r.id || null,                    // id del agregador: clave de dedup interno + lineage
        nombre: r.nombre || "",
        cedula: r.cedula || "",              // interno, para dedup por cédula (HMAC al servir)
        edad: num(r.edad),
        sexo: r.sexo || "",
        estado: STATUS[(r.estado || "").toLowerCase()] ?? "unknown",
        estadoRaw: r.estado || "",
        ubicacion: r.ultima_ubicacion || "",
        descripcion: r.descripcion || "",
        ultimaVez: r.ultima_vez || null,
        foto: r.foto || null,                // URL del cartel (revela el backend de origen)
        creado: r.creado || null,
        verificado: false,
        fuente: "encuentralos",
        // PII de terceros NO se mapea: reporta_contacto, pv_por, pv_contacto, pv_lugar, pv_salud, pv_relacion
      },
      coords: lat != null && lng != null ? { lat, lng } : null,
      fetchedAt: new Date().toISOString(),
    };
  });
}

async function fetchPage(offset, q) {
  const u = `${BASE}?limit=${PAGE}&offset=${offset}` + (q ? `&q=${encodeURIComponent(q)}` : "");
  const r = await fetch(u, {
    headers: { "user-agent": "tierra-firme/1.0 (humanitarian)", accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json(); // { items: [...], total: N }
}

/** Búsqueda dirigida de una persona (cédula o nombre). Proporcional, no baja el set.
 *  @param {string} q @returns {Promise<import("../model/index.js").Registro[]>} */
export async function buscar(q) {
  return normalize((await fetchPage(0, q)).items);
}

// `creado` es fecha (a veces datetime) → compara solo el día (YYYY-MM-DD). Truncar ambos lados
// hace el watermark robusto a granularidad mixta; el solapamiento del día se deduplica en run.js.
const day = (c) => (c ? String(c).slice(0, 10) : null);

/** Filtra registros nuevos por watermark `since` (fecha del último `creado` ya ingerido).
 *  Usa `>=` (incluye el día del watermark → no pierde altas del mismo día) y conserva los
 *  registros sin `creado` (no arriesgar perderlos). since=null → todo (1ra corrida / resync).
 *  @param {import("../model/index.js").Registro[]} regs @param {?string} since */
export function selectNew(regs, since) {
  if (!since) return regs;
  const s = day(since);
  return regs.filter((r) => { const d = day(r.payload.creado); return !d || d >= s; });
}

const pageAllOlder = (regs, since) => {
  const s = day(since);
  return regs.length > 0 && regs.every((r) => { const d = day(r.payload.creado); return d && d < s; });
};

async function fetchFull(maxPages) {
  const first = await fetchPage(0);
  const total = first.total ?? first.items?.length ?? 0;
  const out = normalize(first.items);
  const pages = Math.min(Math.ceil(total / PAGE), maxPages);
  for (let p = 1; p < pages; p++) out.push(...normalize((await fetchPage(p * PAGE)).items));
  if (total > maxPages * PAGE)
    console.warn(`  ! encuentralos: cap ${maxPages} pág; ${total} total (faltan ${total - maxPages * PAGE})`);
  return out;
}

/** Ingesta incremental: con `since`, pagina desde el frente y corta cuando una página entera
 *  es más vieja que el watermark — trae solo lo nuevo, no las 107k. Sin `since` → pull completo.
 *  ponytail: asume orden newest-first (típico de un listado de "reportes recientes"). Si sale
 *    vacío (orden distinto, watermark corrupto, o fuente en calma) → pull completo para NO perder
 *    altas nuevas. Techo: en periodo sin cambios cada corrida baja todo; upgrade = confirmar
 *    `&orderby=creado.desc` en el API y quitar el resync.
 *  @param {{since?:?string, maxPages?:number}} [opts] @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros({ since = null, maxPages = 2000 } = {}) {
  if (!since) return fetchFull(maxPages);
  const first = await fetchPage(0);
  const total = first.total ?? first.items?.length ?? 0;
  const out = selectNew(normalize(first.items), since);
  const pages = Math.min(Math.ceil(total / PAGE), maxPages);
  for (let p = 1; p < pages; p++) {
    const regs = normalize((await fetchPage(p * PAGE)).items);
    if (pageAllOlder(regs, since)) break;          // orden newest-first: el resto es más viejo
    out.push(...selectNew(regs, since));
  }
  return out.length ? out : fetchFull(maxPages);   // auto-heal: nada nuevo al frente → resync seguro
}
