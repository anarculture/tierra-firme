/* Fuente: AyudaVE (ayudahumanitariavenezuela.com/api/centers) — centros de acopio (JSON).
   Read-only. Muchos centros traen coords:null → no van al mapa, sí al directorio. */
const URL = "https://ayudahumanitariavenezuela.com/api/centers";

function parseCoords(c) {
  if (!c) return null;
  if (typeof c === "object" && c.lat != null && c.lng != null) return { lat: +c.lat, lng: +c.lng };
  if (typeof c === "string") {
    const p = c.split(",").map((s) => parseFloat(s.trim()));
    if (p.length === 2 && p.every((n) => !isNaN(n))) return { lat: p[0], lng: p[1] };
  }
  return null;
}

/** @param {any} raw @returns {import("../model/index.js").Registro[]} */
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : raw?.items || raw?.centers || [];
  return list.map((c) => ({
    sourceId: "ayudave",
    categoria: "centro",
    payload: { name: c.name || c.nombre || "", type: c.type || "", estado: c.estado || "", municipio: c.municipio || "", address: c.address || "", needs: c.needs || [], status: c.status || "" },
    coords: parseCoords(c.coords),
    fetchedAt: new Date().toISOString()
  }));
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const r = await fetch(URL, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(await r.json());
}
