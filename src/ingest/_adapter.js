/* Contrato base de adaptador de ingesta (READ-ONLY).
   Cada Fuente implementa fetchRegistros() → Registro[]. NUNCA escribe a la Fuente.
   La lista declarativa de Fuentes vive en sources.manifest.json. */

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  // TODO(Sx): los adaptadores concretos sobreescriben esto.
  throw new Error("adapter base: implementar fetchRegistros() en cada Fuente");
}
