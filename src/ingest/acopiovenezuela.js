/* Fuente: Acopio Venezuela (acopiovenezuela.vercel.app) — centros de acopio.
   Exposición exacta por confirmar → normalize tolerante. Read-only. */
const URL = "https://acopiovenezuela.vercel.app/api/centros";
const num = (v) => (v == null || v === "" ? null : Number(v));

function parseCoords(c, item) {
  if (c && typeof c === "object" && c.lat != null) return { lat: +c.lat, lng: +(c.lng ?? c.lon) };
  if (typeof c === "string") { const p = c.split(",").map((s) => parseFloat(s.trim())); if (p.length === 2 && p.every((n) => !isNaN(n))) return { lat: p[0], lng: p[1] }; }
  const lat = num(item?.lat ?? item?.latitude ?? item?.latitud), lng = num(item?.lng ?? item?.lon ?? item?.longitude ?? item?.longitud);
  return lat != null && lng != null ? { lat, lng } : null;
}

/** @param {any} raw @returns {import("../model/index.js").Registro[]} */
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : raw?.items || raw?.centros || raw?.data || [];
  return list.map((c) => ({
    sourceId: "acopiovenezuela",
    categoria: "centro",
    payload: { name: c.name || c.nombre || "", estado: c.estado || c.state || "", address: c.address || c.direccion || "", needs: c.needs || c.necesidades || [] },
    coords: parseCoords(c.coords || c.location, c),
    fetchedAt: new Date().toISOString()
  }));
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const r = await fetch(URL, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(await r.json());
}
