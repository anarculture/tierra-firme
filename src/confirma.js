/* Confirmación inline de Compra/Entrega en el chat (issue 08). Baja fricción: el
   comprador reporta, el bot hace ECO estructurado, el autor confirma con una palabra y
   la Compra/Entrega entra al libro YA confirmada-por-autor. Reduce la revisión batch del
   operador a un escaneo (las líneas ya vienen confirmadas por quien las conoce).

   Engine puro (eco + interpretar + confirmar); la conversación stateful la maneja el bot. */
import { totalCompra, ingestCompra, ingestEntrega } from "./libro.js";

const money = (n) => (Number(n) || 0).toLocaleString("es-VE");

/** Eco estructurado de una Compra propuesta. */
export function ecoCompra(c) {
  const lineas = (c.items || []).map((it) => `${it.cantidad}× ${it.insumo} @${it.costo_unitario}`).join(", ");
  const total = c.costo_total != null ? Number(c.costo_total) : totalCompra(c.items);
  return `Registré: ${lineas} · total ${money(total)} Bs. ¿Correcto? SÍ / editar.`;
}

/** Eco estructurado de una Entrega propuesta. */
export function ecoEntrega(e) {
  const lineas = (e.items || []).map((it) => `${it.cantidad}× ${it.insumo}`).join(", ");
  const dst = typeof e.destino === "string" ? e.destino : e.destino?.nombre || "destino";
  return `Registré entrega: ${lineas} → ${dst}. ¿Correcto? SÍ / editar.`;
}

/** Eco según el tipo de la clasificación (#07). */
export function eco(pendiente) {
  return pendiente?.categoria === "entrega" ? ecoEntrega(pendiente) : ecoCompra(pendiente);
}

const SI = new Set(["si", "sí", "sip", "sii", "correcto", "ok", "okey", "dale", "listo", "confirmo", "confirmado", "exacto", "perfecto"]);

/** Interpreta la respuesta del autor: 'si' (confirma) | 'editar' | 'otro'.
 *  (Sin \b: rompe con acentos en JS — usamos primera-palabra + patrón de edición.) */
export function interpretarRespuesta(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return "otro";
  if (/👍|✅/.test(t)) return "si";
  if (SI.has(t.split(/[\s,.!?]+/)[0])) return "si";
  if (/(^|\s)(no|mal|edit|corrig|cambi|arregl)/.test(t)) return "editar";
  return "otro";
}

/** El autor confirmó → entra al libro marcada confirmado_por_autor. Muta libro. */
export function confirmar(libro, pendiente) {
  const flag = { confirmado_por_autor: true };
  if (pendiente.categoria === "entrega") return { tipo: "entrega", registro: ingestEntrega(libro, { ...pendiente, ...flag }) };
  return { tipo: "compra", registro: ingestCompra(libro, { ...pendiente, ...flag }) };
}
