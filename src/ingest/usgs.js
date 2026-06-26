/* Fuente: USGS FDSNWS — catálogo de réplicas (fallback de SismosVE).
   Caja Yaracuy–Carabobo–La Guaira, ventana del evento us6000t7zp. Read-only.
   El pronóstico OAF NO tiene JSON limpio → vive en src/curated/replicas-oaf.json. */
const BOX = "minlatitude=9&maxlatitude=12&minlongitude=-70&maxlongitude=-66";
const URL = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2026-06-24&endtime=2026-06-30&minmagnitude=3.5&${BOX}`;

/** @param {any} geojson @returns {import("../model/index.js").Registro[]} */
export function normalize(geojson) {
  const feats = geojson?.features ?? [];
  return feats.map((f) => {
    const c = f.geometry?.coordinates ?? [];
    return {
      sourceId: "usgs",
      categoria: "replica",
      payload: { mag: f.properties?.mag ?? null, place: f.properties?.place ?? "", time: f.properties?.time ?? null, depth: c[2] ?? null },
      coords: c[1] != null && c[0] != null ? { lat: c[1], lng: c[0] } : null,
      fetchedAt: new Date().toISOString()
    };
  });
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const r = await fetch(URL, { headers: { "user-agent": "monitorVE/1.0 (humanitarian)" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(await r.json());
}
