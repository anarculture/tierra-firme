// Extracción de insumos/recursos desde imágenes con Gemini (VLM) + umbral de
// confianza. Cubre el gap #2 del bot: las listas críticas solo existen como
// fotos (ver ASIGNACION-RECURSOS-28-29jun.md / analiza.js).
//
// Estilo casa: vanilla JS + stdlib + fetch. SIN deps (ni SDK ni tesseract):
// llamamos el endpoint NATIVO generateContent de Gemini por fetch, igual que
// ingest/destilador.py. Reutiliza la key de .env (ANALIZA_API_KEY / VLM_API_KEY).
//
// Reutilizable: scripts/extract-media.mjs (lote sobre un directorio) y, más
// adelante, el bot al recibir media. Devuelve ítems estructurados + confianza;
// lo de baja confianza o no-relevante queda marcado para la compuerta humana.
//
// PII: el prompt prohíbe extraer nombres/teléfonos/datos personales. Igual la
// salida es sensible (regla TF: PII nunca sale a lo público) → trátala gated.

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Spec por defecto: insumos/recursos de emergencia. Ampliado a propósito para
// aceptar tanto listas ESCRITAS como FOTOS de productos/equipos físicos (las
// ofertas suelen ser fotos, no texto).
export const SUPPLY_SPEC = {
  instruction:
    "una foto, captura o lista de insumos/recursos para una emergencia hospitalaria o de rescate. " +
    "Puede ser: una lista escrita o manuscrita, una captura de chat, o una FOTO de productos/equipos " +
    "físicos disponibles (medicamentos, instrumental, herramientas, EPP).",
  fields: [
    { name: "articulo", description: "nombre del insumo, medicamento, equipo o recurso" },
    { name: "cantidad", description: "cantidad numérica si aparece (null si no)", type: "number" },
    { name: "unidad", description: "unidad: cajas, unidades, ampollas, pares, etc. (null si no aplica)" },
    { name: "notas", description: "detalle del renglón: presentación, dosis, marca, calibre (sin datos personales)" },
  ],
};

// Spec de FACTURA (issue 09): líneas de una factura/recibo de compra. Añade
// costo_unitario — lo que distingue una compra de una lista de necesidades.
export const FACTURA_SPEC = {
  instruction:
    "una FOTO de una factura, recibo o nota de compra de insumos (medicinas, material médico, " +
    "herramientas). Tiene renglones con artículo, cantidad y precio.",
  fields: [
    { name: "articulo", description: "nombre del insumo/producto del renglón" },
    { name: "cantidad", description: "cantidad numérica del renglón (null si no)", type: "number" },
    { name: "costo_unitario", description: "precio unitario numérico del renglón (null si no)", type: "number" },
  ],
};

// --- JSON Schema (subconjunto soportado por Gemini responseJsonSchema) ---
function itemSchema(spec) {
  const props = {};
  for (const f of spec.fields) {
    const base = f.type === "number" ? "number" : "string";
    props[f.name] = {
      type: "object",
      properties: {
        value: { anyOf: [{ type: base }, { type: "null" }] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["value", "confidence"],
    };
  }
  return { type: "object", properties: props, required: spec.fields.map((f) => f.name) };
}

function listSchema(spec) {
  return {
    type: "object",
    properties: {
      relevant: { type: "boolean" },
      relevanceNote: { type: "string" },
      items: { type: "array", items: itemSchema(spec) },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["relevant", "relevanceNote", "items", "confidence"],
  };
}

function buildPrompt(spec) {
  const fields = spec.fields.map((f) => `- ${f.name} (${f.type || "string"}): ${f.description}`).join("\n");
  return (
    `Eres un extractor de datos para una plataforma humanitaria de crisis (terremoto). ` +
    `La imagen es: ${spec.instruction}\n\n` +
    `Extrae CADA insumo/recurso como un ítem con estos campos:\n${fields}\n\n` +
    `Reglas:\n` +
    `- Un ítem por insumo, ya sea un renglón de una lista o un producto visible en una foto.\n` +
    `- NO inventes. Campo ausente ⇒ value=null y confidence baja.\n` +
    `- PRIVACIDAD (estricto): NUNCA extraigas ni copies nombres de personas, teléfonos, ` +
    `cédulas ni datos personales. Solo insumos/recursos y cantidades.\n` +
    `- Si la imagen NO trata de insumos/recursos (p. ej. comprobante de pago, saldo de cuenta, ` +
    `foto de personas, flyer de donación, captura de contactos, fachada sin productos visibles), ` +
    `pon relevant=false, items=[] y explica en relevanceNote. NO extraigas nada en ese caso.\n` +
    `- confidence por ítem = qué tan seguro de ESE insumo; confidence global = de toda la extracción.\n` +
    `- Responde SOLO el JSON del esquema.`
  );
}

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Llama a Gemini (nativo generateContent) con la imagen + esquema y devuelve el
 * objeto crudo {relevant, relevanceNote, items, confidence}.
 */
export async function callGeminiVlm({ apiKey, model, dataB64, mimeType, spec }) {
  const res = await fetch(ENDPOINT(model), {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType, data: dataB64 } }, { text: buildPrompt(spec) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: listSchema(spec),
        // Alto a propósito: gemini-pro gasta tokens de "thinking" que cuentan
        // contra este cap; con poco margen el JSON sale truncado (MAX_TOKENS).
        maxOutputTokens: 32768,
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const cand = j?.candidates?.[0];
  if (!cand) {
    const reason = j?.promptFeedback?.blockReason || "sin candidatos";
    throw new Error(`gemini sin respuesta (${reason})`);
  }
  if (cand.finishReason && cand.finishReason !== "STOP") {
    throw new Error(`gemini finishReason=${cand.finishReason} (respuesta incompleta)`);
  }
  const text = (cand.content?.parts || []).map((p) => p.text).filter(Boolean).join("");
  if (!text) throw new Error("gemini: respuesta vacía");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`gemini: JSON inválido: ${text.slice(0, 200)}`);
  }
  return parsed;
}

/** Normaliza el objeto crudo del VLM a {items, relevant, relevanceNote, confidence}. */
export function normalizeVlm(parsed, spec) {
  const items = (parsed?.items || []).map((raw) => {
    const fields = {};
    for (const f of spec.fields) {
      const cell = raw?.[f.name];
      const value = cell?.value;
      fields[f.name] = { value: value === undefined || value === "" ? null : value, confidence: num(cell?.confidence) };
    }
    return { fields, confidence: num(raw?.confidence ?? parsed?.confidence) };
  });
  return {
    items,
    relevant: parsed?.relevant !== false,
    relevanceNote: typeof parsed?.relevanceNote === "string" ? parsed.relevanceNote : "",
    confidence: num(parsed?.confidence),
  };
}

/**
 * Aplica el umbral. PURA (testeable sin red): decide si va a revisión.
 * No relevante ⇒ siempre a revisión (no auto-aceptar aunque la confianza sea alta).
 */
export function decide(vlm, threshold = 0.7) {
  const confidence = clamp01(vlm.confidence);
  return {
    items: vlm.items || [],
    relevant: vlm.relevant !== false,
    relevanceNote: vlm.relevanceNote || "",
    confidence,
    threshold,
    needsReview: vlm.relevant === false || confidence < threshold,
  };
}

/** Pipeline completo: imagen → Gemini → resultado con gate de revisión. */
export async function extractList({ dataB64, mimeType, spec = SUPPLY_SPEC, apiKey, model, threshold }) {
  const raw = await callGeminiVlm({ apiKey, model, dataB64, mimeType, spec });
  return decide(normalizeVlm(raw, spec), threshold);
}
