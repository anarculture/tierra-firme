/* Gate PII al servir bundles de personas (§5 plan · CLAUDE.md · no-negociable).
   server.js es allow-all por nombre de archivo; estos bundles llevan PII (nombre/cédula de personas
   vivas) → público se REDACTA: cédula enmascarada (****XXXX, nunca dígitos crudos), nombre/foto/id
   fuera. Solo el canal gateado (TF_API_KEY correcta) recibe el payload completo. Fail-closed: sin
   TF_API_KEY en el entorno, siempre redacta.
   ponytail: cierra la fuga concreta (server.js sirve /api/personas crudo). server.js sigue siendo
     allow-all para bundles públicos (replicas/centros/danos); deny-by-default es la postura de
     data/api.py — upgrade path si server.js pasa a ser la capa pública real. */

// Bundles con PII de personas → redactar salvo canal gateado.
export const PII_BUNDLES = new Set(["personas", "missing", "patients"]);

// Cédula → solo últimos 4 dígitos. Nunca los dígitos crudos. Vacío/no-numérico → "".
export const maskCedula = (c) => {
  const s = String(c ?? "").replace(/\D/g, "");
  return s ? "****" + s.slice(-4) : "";
};

// Descarta identificadores directos, enmascara la cédula. Conserva campos agregados (estado/geo/edad).
export function redactPersonas(body) {
  const items = (body?.items || []).map((r) => {
    if (!r?.payload) return r;
    const { nombre, foto, id, cedula, ...rest } = r.payload;   // nombre/foto/id fuera (re-identifican)
    return { ...r, payload: { ...rest, cedula: maskCedula(cedula) } };
  });
  return { ...body, items, _redacted: true };
}

/** Aplica el gate al servir. @param {string} name @param {object} body
 *  @param {?string} apiKey key provista en la request @param {?string} envKey TF_API_KEY del entorno */
export function serveBody(name, body, apiKey, envKey) {
  if (!PII_BUNDLES.has(name)) return body;         // bundle público → sin tocar
  if (envKey && apiKey === envKey) return body;    // canal interno autenticado → completo
  return redactPersonas(body);                     // público (o sin TF_API_KEY) → redactado
}
