/* Diff entre corridas → EVENTOS accionables (§6 plan). El valor del agente no es solo el dump sino
   el CAMBIO: persona desaparecido→encontrado, nuevo fallecido, nuevo colapso, nuevo acopio.
   Puro y determinista (sin red): compara items previos vs actuales por identidad. Los eventos
   críticos (encontrado/fallecido) se marcan `revision:true` → van a la compuerta humana, no público. */

// Identidad por tipo: id/cédula fuertes; si no, hub_id; si no, geo redondeada (~11 m); si no, nombre|lugar.
const geoKey = (c) => (c && c.lat != null && c.lng != null ? `${c.lat.toFixed(4)},${c.lng.toFixed(4)}` : null);
export const idOf = (r) =>
  r.payload?.id || r.payload?.cedula || r.payload?.hubId || r.payload?.hub_id ||
  geoKey(r.coords) || `${r.payload?.nombre ?? ""}|${r.payload?.place ?? r.payload?.ubicacion ?? ""}`;

const estadoOf = (r) => r.payload?.estado ?? null;
const CRITICO = new Set(["found", "deceased"]);   // encontrado / fallecido → aviso a familia, revisión humana

const evt = (tipo, categoria, antes, despues, registro) =>
  ({ tipo, categoria, antes, despues, registro, revision: CRITICO.has(despues) });

/** Compara snapshot previo vs actual → eventos tipados. Sin previo → todo "nuevo" (sin falsos "cambió").
 *  @param {import("../model/index.js").Registro[]} prev @param {import("../model/index.js").Registro[]} curr
 *  @param {string} categoria @returns {{tipo,categoria,antes,despues,registro,revision}[]} */
export function diff(prev, curr, categoria) {
  const prevMap = new Map((prev ?? []).map((r) => [idOf(r), r]));
  const out = [];
  for (const r of curr ?? []) {
    const old = prevMap.get(idOf(r));
    if (!old) out.push(evt("nuevo", categoria, null, estadoOf(r), r));
    else if (estadoOf(old) !== estadoOf(r)) out.push(evt("cambio-estado", categoria, estadoOf(old), estadoOf(r), r));
  }
  return out;
}
