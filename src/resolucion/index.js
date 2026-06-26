/* Resolución — la ÚNICA intake del sistema (Q1/Q2): marcar "esta persona ya apareció".
   Es una anotación sobre un Registro/Clúster; NO muta la Fuente.
   Escribe en la Capa propia (Supabase: tabla resolutions). */

/**
 * @param {{ recordId?: string, clusterId?: string, reportedBy?: string }} input
 * @returns {Promise<import("../model/index.js").Resolucion>}
 */
export async function markResolved(input) {
  // TODO(Sx): validar input + escribir en Supabase (resolutions) + flip estado→localizada.
  throw new Error("resolución: TODO(Sx)");
}
