/* Fuente: Desaparecidos Terremoto Venezuela (desaparecidosterremotovenezuela.com).
   Personas (~42k) + directorio de líneas de emergencia. Exposición: scrape (Next.js/S3). Read-only. */
/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  // TODO(Sx): extraer personas → Registro[] categoria 'persona'. Teléfonos → Entrada curada (panel vital).
  return [];
}
