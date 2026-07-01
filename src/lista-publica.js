/* Lista pública recortada (issue 05) — la mitad "qué hace falta" del ciclo de confianza
   cara-a-donante (ADR 0006). Se genera del libro interno y pasa por compuerta humana.

   DOS INVARIANTES DUROS:
   - Solo campos seguros: `zona + insumo + urgencia`. Nada de lugar con detalle de
     paciente, contacto, estado interno, costos ni quién. Allowlist deny-by-default.
   - Solo necesidades `vigente` (ADR 0005): auto-descarta comprada/entregada/verificada/
     cancelada. Nunca engaña a un donante para financiar algo ya resuelto (anti-bullwhip). */
import { derivarEstado } from "./libro.js";

/** Recorta el libro a la lista pública. Puro, sin IO, sin PII. */
export function listaPublica(libro, meta = {}) {
  const necesidades = [];
  for (const n of libro.necesidades || []) {
    if (derivarEstado(n, libro) !== "vigente") continue; // filtro de estado: solo lo vivo
    necesidades.push({                                    // recorte de campos: solo los 3 seguros
      zona: n.destino?.zona || "",
      insumo: n.insumo,
      urgencia: n.urgencia || "media",
    });
  }
  return { fecha: meta.fecha || "", necesidades };
}
