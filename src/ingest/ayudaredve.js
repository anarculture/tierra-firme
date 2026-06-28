/* Fuente: Ayuda Venezuela Red (ayuda-venezuela-red.vercel.app) — DEMANDA estructurada.
   /api/zonas (zonas de apoyo) + /api/necesidades (ítems por zona). Read-only, sin auth.
   ⚠️ Escrituras abiertas sin auth → crowdsourced NO verificado → payload.verificado=false.
   ⚠️ SIN licencia declarada → NO re-publicar por el API público (/v1) hasta tener permiso.
   Complementa acopiove (oferta); esto es la otra punta (demanda). */
const BASE = "https://ayuda-venezuela-red.vercel.app/api";
const num = (v) => (v == null || v === "" ? null : Number(v));

/** Une zonas + necesidades en Registros `zona` (cada zona lleva sus necesidades).
 * @param {any[]} zonas @param {any[]} necesidades
 * @returns {import("../model/index.js").Registro[]} */
export function normalize(zonas, necesidades = []) {
  const list = Array.isArray(zonas) ? zonas : [];
  const byZona = {};
  for (const n of (Array.isArray(necesidades) ? necesidades : [])) {
    (byZona[n.zona_id] ||= []).push({
      categoria: n.categoria, articulo: n.articulo,
      cantidad: num(n.cantidad), prioridad: n.prioridad, estatus: n.estatus
    });
  }
  return list.map((z) => {
    const lat = num(z.latitud), lng = num(z.longitud);
    return {
      sourceId: "ayuda-venezuela-red",
      categoria: "zona",
      payload: {
        nombre: z.nombre || "", estado: z.estado || "", municipio: z.municipio || "",
        ciudad: z.ciudad || "", descripcion: z.descripcion || "",
        severidad: z.severidad || "", personasAfectadas: num(z.personas_afectadas),
        verificado: false,                 // escrituras abiertas → leads sin confirmar
        necesidades: byZona[z.id] || []
      },
      coords: lat != null && lng != null ? { lat, lng } : null,  // solo ~2/29 traen geo
      fetchedAt: new Date().toISOString()
    };
  });
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const opt = { headers: { "user-agent": "TierraFirme/1.0 (humanitarian)", "accept": "application/json" },
                signal: AbortSignal.timeout(15000) };
  const [zr, nr] = await Promise.all([fetch(`${BASE}/zonas`, opt), fetch(`${BASE}/necesidades`, opt)]);
  if (!zr.ok) throw new Error("zonas HTTP " + zr.status);
  if (!nr.ok) throw new Error("necesidades HTTP " + nr.status);
  return normalize(await zr.json(), await nr.json());
}
