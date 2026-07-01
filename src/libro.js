/* El Libro — modelo de dominio base de Tierra Firme (issue 01).
   Tres bitácoras ligables-opcional (Necesidad/Compra/Entrega) sobre un solo Grupo.
   Invariantes CONGELADOS (no los debilites para pasar un test):
   - Estado DERIVADO de eventos ligados, no tecleado  (ADR 0005).
   - Identidad open-instance: `destino+insumo` normalizados, UNA instancia abierta
     a la vez; resolver libera el cupo                (ADR 0007).
   - Eventos, no inventario                            (ADR 0004).

   Storage = un JSON (Node stdlib, sin deps). El libro es INTERNO (gitignored):
   nombres de destino + costos viven acá, la frontera pública la ponen #04/#05. */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

/** Estados DERIVADOS de eventos (ADR 0005). Orden = prioridad al derivar. */
export const ESTADOS_DERIVADOS = ["vigente", "comprada", "entregada", "verificada"];
/** Estados MANUALES (botón del operador) — no salen de ningún evento. */
export const ESTADOS_MANUALES = ["cancelada", "por_decidir"];
/** Resolver una Necesidad LIBERA EL CUPO open-instance (ADR 0007). `comprada` y
 *  `por_decidir` NO liberan: siguen ocupando el slug para dedup anti-ruido. */
export const RESUELVEN = new Set(["entregada", "verificada", "cancelada"]);

const TIPOS_DESTINO = new Set(["hospital", "punto_apoyo", "centro_acopio", "doctor", "persona", "otro"]);

/** Normaliza para comparar: minúsculas, sin acentos, espacios colapsados. */
export function norm(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

/** Slug estable para el `id`: alfanum + guiones, sin bordes sucios. */
export function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

/** Clave open-instance: dos menciones colisionan si comparten esta clave. */
export function openKey(destinoNombre, insumo) {
  return `${slug(destinoNombre)}|${slug(insumo)}`;
}

/** Libro vacío. `grupo` presente aunque el PoC sea de un solo grupo (no impide multi-grupo). */
export function emptyLibro(grupo = "default") {
  return { grupo, necesidades: [], compras: [], entregas: [] };
}

/** Estado derivado de una Necesidad (ADR 0005). Manual gana sobre derivado. */
export function derivarEstado(nec, libro) {
  if (nec.manual === "cancelada" || nec.manual === "por_decidir") return nec.manual;
  const entregas = (libro.entregas || []).filter((e) => e.necesidad_id === nec.id);
  if (entregas.some((e) => e.foto)) return "verificada";
  if (entregas.length) return "entregada";
  if ((libro.compras || []).some((c) => c.necesidad_id === nec.id)) return "comprada";
  return "vigente";
}

/** ¿Sigue ocupando el cupo open-instance? (no resuelta) */
export function estaAbierta(nec, libro) {
  return !RESUELVEN.has(derivarEstado(nec, libro));
}

/** Cuántas instancias existen ya para esa clave (para numerar el id). */
function instancias(libro, key) {
  return (libro.necesidades || []).filter((n) => openKey(n.destino?.nombre, n.insumo) === key).length;
}

/** Ingesta una mención de Necesidad. Open-instance (ADR 0007):
 *  - hay instancia ABIERTA con misma clave → `reportes++` sobre ella (dedup anti-ruido).
 *  - no hay → abre instancia nueva con `id` estable `destino|insumo#n`.
 *  Muta `libro`. Devuelve { necesidad, accion:'dedup'|'nueva' }. */
export function ingestNecesidad(libro, m) {
  if (!m?.destino?.nombre || !m?.insumo) throw new Error("Necesidad exige destino.nombre + insumo");
  const key = openKey(m.destino.nombre, m.insumo);
  const abierta = (libro.necesidades || []).find(
    (n) => openKey(n.destino?.nombre, n.insumo) === key && estaAbierta(n, libro),
  );
  if (abierta) {
    abierta.reportes = (abierta.reportes || 1) + 1;
    return { necesidad: abierta, accion: "dedup" };
  }
  const tipo = TIPOS_DESTINO.has(m.destino.tipo) ? m.destino.tipo : "otro";
  const nec = {
    id: `${key}#${instancias(libro, key) + 1}`,
    grupo: m.grupo || libro.grupo || "default",
    destino: { nombre: String(m.destino.nombre).trim(), tipo, zona: m.destino.zona || "" },
    insumo: String(m.insumo).trim(),
    cantidad: m.cantidad ?? null,
    urgencia: m.urgencia || "media",
    estado: "vigente", // snapshot informativo; la verdad es derivarEstado()
    reportes: 1,
    ts: m.ts || "",
  };
  libro.necesidades.push(nec);
  return { necesidad: nec, accion: "nueva" };
}

/** Botón del operador: setea un estado MANUAL (o lo limpia con null). */
export function setEstadoManual(libro, id, estado) {
  const nec = (libro.necesidades || []).find((n) => n.id === id);
  if (!nec) throw new Error(`Necesidad no encontrada: ${id}`);
  if (estado === null) { delete nec.manual; return nec; }
  if (!ESTADOS_MANUALES.includes(estado)) throw new Error(`estado manual inválido: ${estado} (usa ${ESTADOS_MANUALES.join("/")})`);
  nec.manual = estado;
  return nec;
}

/** Vista del panel interno: cada Necesidad con su estado DERIVADO al momento. */
export function vistaNecesidades(libro) {
  return (libro.necesidades || []).map((n) => ({ ...n, estado: derivarEstado(n, libro) }));
}

const path = () => new URL("../data/libro.json", import.meta.url);

/** Carga el libro del disco (o vacío si no existe). Normaliza las tres bitácoras. */
export async function loadLibro(file = path()) {
  if (!existsSync(file)) return emptyLibro();
  const raw = JSON.parse(await readFile(file, "utf8"));
  return { grupo: raw.grupo || "default", necesidades: raw.necesidades || [], compras: raw.compras || [], entregas: raw.entregas || [] };
}

/** Persiste el libro. */
export async function saveLibro(libro, file = path()) {
  await writeFile(file, JSON.stringify(libro, null, 2) + "\n");
}
