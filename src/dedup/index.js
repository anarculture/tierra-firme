/* Dedup — clústeres persona×localización.
   LEY (ADR 0001): ENLAZAR, no fusionar; SESGO A SEPARAR (una fusión falsa esconde a una persona).
   Match confirmado (nombre idéntico normalizado + edad/zona) vs Match posible (sugerido, no colapsa).
   Cruce desaparecida×localización = siempre posible hasta confirmación humana.
   NO usar teléfono (es del Reportante). */

/** @param {string} s @returns {string} */
export function normalizeName(s) {
  // TODO(Sx): minúsculas + sin acentos + orden de apellidos (ref: heurística de AyudaVE).
  return String(s ?? "");
}

/**
 * @param {import("../model/index.js").Registro[]} registros
 * @returns {import("../model/index.js").Cluster[]}
 */
export function buildClusters(registros) {
  // TODO(Sx): agrupar con sesgo a separar; emitir CONFIANZA_CLUSTER por nivel.
  return [];
}
