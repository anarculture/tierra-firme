/* Fuente: Terremoto Venezuela (terremotovenezuela.com) — mapa de daños estructurales.
   API implícita /api/public/media/reports/. Forma exacta por confirmar → normalize tolerante. Read-only.
   ⚠️ Licencia: atribuir a terremotovenezuela.com si se publica; sin licencia clara → interno (bundle danos). */
const URL = "https://terremotovenezuela.com/api/public/media/reports/";
const num = (v) => (v == null || v === "" ? null : Number(v));

/** @param {any} raw @returns {import("../model/index.js").Registro[]} */
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : raw?.reports || raw?.items || raw?.results || raw?.data || [];
  return list.map((d) => {
    const lat = num(d.lat ?? d.latitude ?? d.latitud), lng = num(d.lng ?? d.lon ?? d.longitude ?? d.longitud);
    return {
      sourceId: "terremotovenezuela",
      categoria: "dano",
      payload: {
        severity: d.level || d.severity || d.tipo || d.damage || "",
        place: d.address || d.place || d.lugar || "",
        photoUrl: d.photo_url || d.photoUrl || d.image_url || d.image || d.media || d.foto || null,
        time: d.created_at || d.date || d.time || null,
      },
      coords: lat != null && lng != null ? { lat, lng } : null,
      fetchedAt: new Date().toISOString()
    };
  });
}

/** @returns {Promise<import("../model/index.js").Registro[]>} */
export async function fetchRegistros() {
  const r = await fetch(URL, { headers: { "user-agent": "tierra-firme/1.0 (humanitarian)" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return normalize(await r.json());
}
