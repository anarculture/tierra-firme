/* Fuente: crisisvenezuela.org (crisis-pulse) — hechos corroborados del terremoto.
   GET /api/v1/facts: feed de TEXTO LIBRE con procedencia (fuentes[]) y corroboración
   (n_fuentes). NO es un directorio estructurado. Read-only, CC-BY-4.0.
   Lo usamos SOLO para `categoria=daño` (llena el bundle danos, que terremotovenezuela
   ya no sirve). Pedimos min_fuentes=2 para quedarnos con lo corroborado. */
const BASE = "https://crisisvenezuela.org/api/v1/facts";
const URL = `${BASE}?categoria=${encodeURIComponent("daño")}&min_fuentes=2&limite=1000`;
const num = (v) => (v == null || v === "" ? null : Number(v));

/** @param {any} raw @returns {import("../model/index.js").Registro[]} */
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : raw?.datos || raw?.data || [];
  return list.map((d) => {
    const lat = num(d.lat), lng = num(d.lon ?? d.lng);
    return {
      sourceId: "crisisvenezuela",
      categoria: "dano",
      payload: {
        severity: d.nivel || d.estructura || "",
        place: [d.zona, d.municipio, d.estado].filter(Boolean).join(", "),
        time: d.fecha || d.primera_vez || null,
        // valor diferenciado de esta fuente: descripción + corroboración + procedencia.
        descripcion: d.descripcion || "",
        nFuentes: d.n_fuentes ?? null,
        fuentes: Array.isArray(d.fuentes) ? d.fuentes : []
      },
      coords: lat != null && lng != null ? { lat, lng } : null,
      fetchedAt: new Date().toISOString()
    };
  });
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const r = await fetch(URL, {
    headers: { "user-agent": "TierraFirme/1.0 (humanitarian)", "accept": "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(await r.json());
}
