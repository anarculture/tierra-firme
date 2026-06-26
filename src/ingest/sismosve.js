/* Fuente: SismosVE (sismosve.rafnixg.dev/api/sismos) — réplicas (espejo JSON de FUNVISIS).
   Aporta el contador + últimos sismos del pilar Réplicas. Read-only. Respaldo: USGS/EMSC. */
/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  // TODO(Sx): GET /api/sismos/recent → Registro[] categoria 'replica'.
  return [];
}
