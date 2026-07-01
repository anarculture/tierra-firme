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

/** Consume el set completo, paginado. Con cap explícito (no truncar en silencio).
 *  @param {{maxPages?:number}} [opts] @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros({ maxPages = 2000 } = {}) {
  const first = await fetchPage(0);
  const total = first.total ?? first.items?.length ?? 0;
  const out = normalize(first.items);
  const pages = Math.min(Math.ceil(total / PAGE), maxPages);
  for (let p = 1; p < pages; p++) out.push(...normalize((await fetchPage(p * PAGE)).items));
  if (total > maxPages * PAGE)
    console.warn(`  ! encuentralos: cap ${maxPages} pág; ${total} total (faltan ${total - maxPages * PAGE})`);
  return out;
}
