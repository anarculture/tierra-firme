/* Fuente: terremotovenezuela.app — espejo FEDERADO del hub central (otros sitios).
   GET /api/hub/reports?type=<t> → un solo source que alimenta VARIAS categorías:
     help_request→demanda(zona) · help_offer→oferta · damaged_building→dano · missing_person/checkin→persona.
   Read-only, sin PII de contacto (trae nombre/mensaje en persona, NUNCA teléfono).
   Sin paginación: el endpoint vacía TODO el set por tipo en una llamada (limit es decorativo, máx 200).
   ⚠️ Crowdsourced federado, NO verificado → payload.verificado=false.
   ⚠️ SIN licencia declarada → captura INTERNA; NO re-publicar por el API público (/v1) hasta tener permiso. */
const BASE = "https://api.terremotovenezuela.app/api/hub/reports";
const num = (v) => (v == null || v === "" ? null : Number(v));

/** Mapeo por tipo del hub → Registro. Cada tipo declara su categoria + cómo arma el payload. */
const MAP = {
  help_request: (r) => ({ categoria: "zona", payload: {
    nombre: r.place_name || "", ciudad: r.city || "", descripcion: r.description || "",
    categoria: r.category || "", urgencia: r.urgency || "", estatus: r.status || "" } }),
  help_offer: (r) => ({ categoria: "oferta", payload: {
    ciudad: r.city || "", descripcion: r.description || "", categoria: r.category || "",
    disponibilidad: r.availability || "", disponible: r.available === true } }),
  damaged_building: (r) => ({ categoria: "dano", payload: {
    severity: r.severity || "", place: r.place_name || r.city || "",
    photoUrl: r.photo_url || null, photoBroken: r.photo_broken === true } }),
  missing_person: (r) => ({ categoria: "persona", payload: {
    nombre: r.name || "", estatus: r.status || "", ciudad: r.city || "", lugar: r.place_name || "",
    mensaje: r.message || "", photoUrl: r.photo_url || null } }),
};
MAP.checkin = MAP.missing_person; // mismo shape de persona

/** @param {string} type @param {any} raw (array de reports o {reports:[]})
 *  @returns {import("../model/index.js").Registro[]} */
export function normalize(type, raw) {
  const fn = MAP[type];
  if (!fn) return [];
  const list = Array.isArray(raw) ? raw : raw?.reports || [];
  return list.map((r) => {
    const { categoria, payload } = fn(r);
    const lat = num(r.lat), lng = num(r.lng);
    return {
      sourceId: "terremotovenezuela-hub",
      categoria,
      payload: { ...payload, verificado: false, hubId: r.hub_id || null, fuente: r.source || null },
      coords: lat != null && lng != null ? { lat, lng } : null,
      fetchedAt: new Date().toISOString()
    };
  });
}

/** @param {string} type @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros(type) {
  const r = await fetch(`${BASE}?type=${encodeURIComponent(type)}&limit=200`, {
    headers: { "user-agent": "TierraFirme/1.0 (humanitarian)", "accept": "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(type, await r.json());
}
