/* Lista pública recortada (issue 05) — la mitad "qué hace falta" del ciclo de confianza
   cara-a-donante (ADR 0006). Se genera del libro interno y pasa por compuerta humana.

   DOS INVARIANTES DUROS:
   - Solo campos seguros: `zona + insumo + urgencia`. Nada de lugar con detalle de
     paciente, contacto, estado interno, costos ni quién. Allowlist deny-by-default.
   - Solo necesidades `vigente` (ADR 0005): auto-descarta comprada/entregada/verificada/
     cancelada. Nunca engaña a un donante para financiar algo ya resuelto (anti-bullwhip). */
import { derivarEstado, norm } from "./libro.js";

// Tipos de Destino cuyo nombre es INFRAESTRUCTURA PÚBLICA (no PII de persona): seguro
// para mostrar + mapear (issue 10). doctor/persona = PII → nunca sale el nombre (ADR 0006).
const TIPOS_MAPEABLES = new Set(["hospital", "punto_apoyo", "centro_acopio"]);
// Placeholders no-mapeables = nombre COMPLETO genérico (no substring: "Hospital General del
// Oeste" es un hospital real y mapeable — no un placeholder). Comparación normalizada.
const PLACEHOLDERS = new Set(["general", "varias ubicaciones", "varias", "no especificado", "no especificada", "desconocido", "desconocida", "n/d", "s/n", "sn", "?", "-", "x"]);

/** lugar público seguro para una Necesidad, o null. Solo instituciones públicas con nombre
 *  mapeable; jamás un nombre de doctor/persona (PII) ni un placeholder genérico. */
export function lugarPublico(destino) {
  if (!destino || !TIPOS_MAPEABLES.has(destino.tipo)) return null;
  const nombre = String(destino.nombre || "").trim();
  const key = norm(nombre);
  // rechaza placeholders exactos, "por ubicar…", y nombres sin ≥3 alfanuméricos (evita "?", "N/D", pins basura)
  if (!nombre || PLACEHOLDERS.has(key) || key.startsWith("por ubicar") || (nombre.match(/[a-zA-Z0-9]/g) || []).length < 3) return null;
  return nombre;
}

/** Recorta el libro a la lista pública. Puro, sin IO, sin PII. Campos seguros:
 *  zona+insumo+urgencia, más `lugar` SOLO para instituciones públicas mapeables (#10). */
export function listaPublica(libro, meta = {}) {
  const necesidades = [];
  for (const n of libro.necesidades || []) {
    if (derivarEstado(n, libro) !== "vigente") continue; // filtro de estado: solo lo vivo
    const item = { zona: n.destino?.zona || "", insumo: n.insumo, urgencia: n.urgencia || "media" };
    const lugar = lugarPublico(n.destino);
    if (lugar) item.lugar = lugar; // aditivo: solo instituciones públicas, para el link de Maps
    necesidades.push(item);
  }
  return { fecha: meta.fecha || "", necesidades };
}
