/* Foto → OCR → libro (issue 09). Reusa el VLM de src/extract.js para las dos entradas
   por foto del modelo ops+contabilidad:
   - Foto de lista de insumos → Necesidad(es)  (cierra "lista detallada no especificada").
   - Foto de factura → Compra con líneas {insumo,cantidad,costo_unitario} + adjunto guardado.

   Los mappers (vlm → registros del libro) son PUROS y testeables sin red. La llamada al
   VLM (extractList) es la capa de red; el gate testea los mappers con salida VLM mockeada. */
import { readFile } from "node:fs/promises";
import { extractList, SUPPLY_SPEC, FACTURA_SPEC } from "./extract.js";
import { ingestNecesidad, ingestCompra } from "./libro.js";

const API_KEY = process.env.VLM_API_KEY || process.env.ANALIZA_API_KEY || "";
const MODEL = process.env.VLM_MODEL || "gemini-2.5-flash";

const val = (cell) => (cell && cell.value != null && String(cell.value).trim() !== "" ? cell.value : null);

/** VLM (salida de extractList) → menciones de Necesidad para un Destino. Puro. */
export function vlmANecesidades(vlm, destino) {
  const out = [];
  if (vlm?.relevant === false) return out; // no relevante → nada (gate humano ya lo marcó)
  for (const it of vlm?.items || []) {
    const articulo = val(it.fields?.articulo);
    if (!articulo) continue;
    out.push({
      destino,
      insumo: String(articulo).trim(),
      cantidad: val(it.fields?.cantidad),
      urgencia: "media", // la foto no la trae; el operador ajusta en el panel
    });
  }
  return out;
}

/** VLM (salida de extractList con FACTURA_SPEC) → una Compra. Puro. `factura` = ruta
 *  del adjunto guardado (interno, nunca público). */
export function vlmACompra(vlm, { factura = null, quien_compro = "", necesidad_id = null } = {}) {
  const items = [];
  for (const it of vlm?.items || []) {
    const articulo = val(it.fields?.articulo);
    if (!articulo) continue;
    items.push({
      insumo: String(articulo).trim(),
      cantidad: Number(val(it.fields?.cantidad)) || 0,
      costo_unitario: Number(val(it.fields?.costo_unitario)) || 0,
    });
  }
  return { items, factura, quien_compro, necesidad_id };
}

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const mimeOf = (p) => MIME[(p.split(".").pop() || "").toLowerCase()] || "image/jpeg";

/** Foto de lista → menciones de Necesidad (llama al VLM). Devuelve las menciones;
 *  quien ingesta al libro es el caller (o ingestaFotoNecesidad). */
export async function fotoANecesidades(path, destino, { apiKey = API_KEY, model = MODEL } = {}) {
  const dataB64 = (await readFile(path)).toString("base64");
  const vlm = await extractList({ dataB64, mimeType: mimeOf(path), spec: SUPPLY_SPEC, apiKey, model });
  return { menciones: vlmANecesidades(vlm, destino), vlm };
}

/** Foto de factura → Compra (llama al VLM). Guarda la ruta como adjunto interno. */
export async function fotoAFactura(path, opts = {}) {
  const dataB64 = (await readFile(path)).toString("base64");
  const vlm = await extractList({ dataB64, mimeType: mimeOf(path), spec: FACTURA_SPEC, apiKey: opts.apiKey || API_KEY, model: opts.model || MODEL });
  return { compra: vlmACompra(vlm, { factura: path, ...opts }), vlm };
}

/** Conveniencia: foto de lista → ingesta N Necesidades al libro. Muta libro. */
export function ingestaFotoNecesidades(libro, menciones) {
  return menciones.map((m) => ingestNecesidad(libro, m).necesidad);
}

/** Conveniencia: foto de factura → ingesta una Compra al libro. Muta libro. */
export function ingestaFotoFactura(libro, compra) {
  return ingestCompra(libro, compra);
}
