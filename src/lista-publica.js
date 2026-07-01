/* Lista pública recortada (issue 05) — la mitad "qué hace falta" del ciclo de confianza
   cara-a-donante (ADR 0006). Se genera del libro interno y pasa por compuerta humana.

   DOS INVARIANTES DUROS:
   - Solo campos seguros: `zona + insumo + urgencia`. Nada de lugar con detalle de
     paciente, contacto, estado interno, costos ni quién. Allowlist deny-by-default.
   - Solo necesidades `vigente` (ADR 0005): auto-descarta comprada/entregada/verificada/
     cancelada. Nunca engaña a un donante para financiar algo ya resuelto (anti-bullwhip). */
import { derivarEstado } from "./libro.js";

// Tipos de Destino cuyo nombre es INFRAESTRUCTURA PÚBLICA (no PII de persona): seguro
// para mostrar + mapear (issue 10). doctor/persona = PII → nunca sale el nombre (ADR 0006).
const TIPOS_MAPEABLES = new Set(["hospital", "punto_apoyo", "centro_acopio"]);
// Nombres genéricos = no mapeables → sin lugar ni link (issue 10: "General", "varias ubicaciones").
const NO_MAPEABLE = /^\s*$|general|varias ubicaciones|por ubicar|no especificad|desconocid/i;

/** lugar público seguro para una Necesidad, o null. Solo instituciones públicas con nombre
 *  mapeable; jamás un nombre de doctor/persona (PII). */
export function lugarPublico(destino) {
  if (!destino || !TIPOS_MAPEABLES.has(destino.tipo)) return null;
  const nombre = String(destino.nombre || "").trim();
  return nombre && !NO_MAPEABLE.test(nombre) ? nombre : null;
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
