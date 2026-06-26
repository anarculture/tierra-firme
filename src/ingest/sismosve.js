/* Fuente: SismosVE (sismosve.rafnixg.dev/api/sismos) — réplicas (espejo JSON de FUNVISIS).
   Aporta contador + últimos sismos del pilar Réplicas. Read-only. Fallback: usgs.js. */
const URL_RECENT = "https://sismosve.rafnixg.dev/api/sismos/recent";
const num = (v) => (v == null || v === "" ? null : Number(v));

function pickList(raw) {
  if (Array.isArray(raw)) return raw;
  for (const k of ["sismos", "data", "results", "items"]) if (Array.isArray(raw?.[k])) return raw[k];
  return [];
}

/** @param {any} raw @returns {import("../model/index.js").Registro[]} */
export function normalize(raw) {
  return pickList(raw).map((s) => {
    const lat = num(s.latitud ?? s.latitude ?? s.lat);
    const lng = num(s.longitud ?? s.longitude ?? s.lng ?? s.lon);
    return {
      sourceId: "sismosve",
      categoria: "replica",
      payload: {
        mag: num(s.magnitud ?? s.magnitude ?? s.mag),
        depth: num(s.profundidad ?? s.depth),
        place: s.lugar ?? s.localidad ?? s.location ?? s.place ?? s.referencia ?? "",
        time: s.timestamp ?? s.fecha ?? s.datetime ?? s.time ?? null
      },
      coords: lat != null && lng != null ? { lat, lng } : null,
      fetchedAt: new Date().toISOString()
    };
  });
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const r = await fetch(URL_RECENT, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(await r.json());
}
