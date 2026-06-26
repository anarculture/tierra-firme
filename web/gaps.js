/* Heatmap de gaps — agrega necesidad (demand) y cobertura (centros) por estado. Puro. */
function norm(s) { return String(s || "").replace(/\s*\(.*\)\s*/g, "").trim(); }

/** @returns {Object<string,{needs:number,centros:number}>} */
export function needsPorEstado(centros) {
  const out = {};
  for (const c of centros || []) {
    const e = norm(c.payload?.estado);
    if (!e) continue;
    const n = (c.payload?.needs || []).length;
    if (!out[e]) out[e] = { needs: 0, centros: 0 };
    out[e].needs += n;
    out[e].centros += 1;
  }
  return out;
}
