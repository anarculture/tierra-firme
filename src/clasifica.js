/* Clasificación en el chat + desambiguación al reportante (issue 07) — el corazón de la
   misión del bot. Clasifica cada dump en 5 categorías y, cuando una Necesidad se repite,
   pregunta EN EL CHAT al reportante si es "lo mismo o más" (ADR 0007).

   El ENGINE (rutear + desambiguación) es PURO y testeable sin red. La clasificación LLM
   (`clasificar`) es la capa de red; el gate testea el ruteo de las 5 categorías + mismo/más. */
import { norm, ingestNecesidad, ingestCompra, ingestEntrega, necesidadAbierta } from "./libro.js";

export const CATEGORIAS = ["necesidad_nueva", "actualizacion", "compra", "entrega", "ruido"];

const BASE_URL = process.env.DESTILA_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
const API_KEY = process.env.DESTILA_API_KEY || process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY || "";
const MODEL = process.env.CLASIFICA_MODEL || "gemini-2.5-flash-lite";

const SYSTEM = `Clasificás UN mensaje reenviado al bot de un Grupo de apoyo (crisis sísmica VE) en una de 5 categorías y extraés sus campos. Money-in y routing quedan FUERA del PoC.

Categorías:
- necesidad_nueva: falta un insumo en un lugar ("el Pérez necesita 200 gasas").
- actualizacion: movimiento sobre una necesidad existente ("eso ya no hace falta", "ya se cubrió lo del Pérez").
- compra: alguien compró insumos ("compré 200 gasas a 130 c/u").
- entrega: insumos llegaron a un destino ("entregué las gasas en el Pérez").
- ruido: saludo, chiste, off-topic, o pedido de persona (va a otro índice).

Extraé, según categoría:
- necesidad_nueva/actualizacion: destino{nombre,tipo,zona}, insumo, cantidad(number|null), urgencia(critica|alta|media|baja).
- compra: items[{insumo,cantidad,costo_unitario}], quien_compro, destino? (para ligar).
- entrega: items[{insumo,cantidad}], destino, quien_entrego.
tipo ∈ [hospital,punto_apoyo,centro_acopio,doctor,persona,otro]. NO inventes: ante duda cantidad=null, urgencia="media".
Respondé SOLO json: {"categoria":"...","destino":{"nombre":"","tipo":"","zona":""},"insumo":"","cantidad":null,"urgencia":"","items":[],"quien_compro":"","quien_entrego":""}`;

/** Clasifica un mensaje vía LLM (network). Devuelve {categoria, ...campos}. */
export async function clasificar(text) {
  if (!API_KEY) throw new Error("falta DESTILA_API_KEY / VLM_API_KEY / ANALIZA_API_KEY");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2048, reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const out = (await res.json()).choices?.[0]?.message?.content;
  if (!out) throw new Error("clasificar: respuesta vacía");
  const c = JSON.parse(out);
  if (!CATEGORIAS.includes(c.categoria)) c.categoria = "ruido"; // categoría desconocida = ruido
  return c;
}

/** Pregunta de desambiguación al reportante (ADR 0007). */
export function preguntaDesambiguacion(nec) {
  return `Ya tengo registrado que ${nec.destino?.nombre || "ese destino"} necesita ${nec.insumo}. ¿Es lo mismo o se necesitan más?`;
}

/** Router PURO: aplica una clasificación al libro y devuelve la acción + (si toca) la
 *  pregunta que el bot debe mandar. NADA se auto-acciona en colisión: se pregunta.
 *  Muta libro salvo en 'desambiguar' (espera la respuesta) y 'ignorar'. */
export function rutear(libro, c) {
  switch (c.categoria) {
    case "ruido":
      return { accion: "ignorar" };
    case "necesidad_nueva": {
      // colisión con instancia ABIERTA → el bot pregunta al reportante, NO auto-dedup (ADR 0007)
      const abierta = necesidadAbierta(libro, c.destino?.nombre, c.insumo);
      if (abierta) return { accion: "desambiguar", necesidad: abierta, pregunta: preguntaDesambiguacion(abierta), pendiente: c };
      const { necesidad } = ingestNecesidad(libro, c);
      return { accion: "necesidad_creada", necesidad };
    }
    case "actualizacion": {
      const abierta = necesidadAbierta(libro, c.destino?.nombre, c.insumo);
      if (!abierta) return { accion: "sin_match" }; // el operador la ubica en el panel (fallback)
      return { accion: "actualizacion", necesidad: abierta }; // el evento ligado la resuelve (02/03)
    }
    case "compra":
      return { accion: "compra_creada", compra: ingestCompra(libro, c) };
    case "entrega":
      return { accion: "entrega_creada", entrega: ingestEntrega(libro, c) };
    default:
      return { accion: "ignorar" };
  }
}

/** ¿La respuesta del reportante significa "más" (no "lo mismo")? ADR 0007.
 *  Si menciona "mismo/igual": negado ("no es lo mismo") → más; afirmado → mismo.
 *  Si no lo menciona: solo señales explícitas de más (evita falsos + con "otra vez"/"se necesita"). */
export function respuestaEsMas(respuesta) {
  const r = norm(respuesta); // norm quita acentos: "más" → "mas"
  if (/mism|igual/.test(r)) return /\bno\b/.test(r);
  return /\bmas\b|adicional|aparte|distint|diferent|otra necesidad|hacen falta|mas cantidad/.test(r);
}

/** Resuelve la desambiguación con la respuesta del reportante (ADR 0007):
 *  "lo mismo" → reportes++ (dedup); "más" → sube cantidad (más demanda). Muta la necesidad. */
export function resolverDesambiguacion(libro, necesidadId, respuesta, pendiente = {}) {
  const nec = (libro.necesidades || []).find((n) => n.id === necesidadId);
  if (!nec) throw new Error(`Necesidad no encontrada: ${necesidadId}`);
  if (respuestaEsMas(respuesta)) {
    const extra = Number(pendiente.cantidad);
    if (Number.isFinite(extra) && Number.isFinite(Number(nec.cantidad))) nec.cantidad = Number(nec.cantidad) + extra;
    else if (Number.isFinite(extra)) nec.cantidad = extra;
    return { accion: "mas", necesidad: nec };
  }
  nec.reportes = (nec.reportes || 1) + 1; // "lo mismo" = otro reporte de lo mismo
  return { accion: "mismo", necesidad: nec };
}
