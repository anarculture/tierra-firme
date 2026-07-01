/* Informe de compras (issue 04) — vista pública de transparencia: la AGREGACIÓN del
   log de Compras del libro interno, calcando el PDF que el Grupo hace a mano.

   FRONTERA PÚBLICA (ADR 0006): allowlist deny-by-default. El informe se arma SOLO con
   {insumo, cantidad, costo_unitario} de cada Compra. Costos SÍ (pilar de transparencia);
   `quien_compro`, `factura`, `necesidad_id`, `ts` NO — nombres de voluntarios y prueba
   interna nunca salen. Si Compra suma un campo, NO aparece salvo que se agregue acá. */

/** Agrega las compras del libro en líneas numeradas + resumen. Puro, sin IO, sin PII.
 *  Líneas iguales (mismo insumo + costo_unitario) se funden sumando cantidad. */
export function agregarInforme(libro, meta = {}) {
  const acc = new Map(); // insumo|costo_unitario → { descripcion, costo_unitario, cantidad }
  for (const c of libro.compras || []) {
    for (const it of c.items || []) {
      const descripcion = String(it.insumo || "").trim();
      const costo_unitario = Number(it.costo_unitario) || 0;
      const cantidad = Number(it.cantidad) || 0;
      if (!descripcion) continue;
      const k = `${descripcion.toLowerCase()}|${costo_unitario}`;
      const row = acc.get(k) || { descripcion, costo_unitario, cantidad: 0 };
      row.cantidad += cantidad;
      acc.set(k, row);
    }
  }
  const lineas = [...acc.values()].map((r, i) => ({
    n: i + 1,
    descripcion: r.descripcion,
    cantidad: r.cantidad,
    costo_unitario: r.costo_unitario,
    costo_total: r.cantidad * r.costo_unitario,
  }));
  const resumen = {
    tipos: new Set(lineas.map((l) => l.descripcion.toLowerCase())).size,
    unidades: lineas.reduce((s, l) => s + l.cantidad, 0),
    total_invertido: lineas.reduce((s, l) => s + l.costo_total, 0),
  };
  return { fecha: meta.fecha || "", grupo: meta.grupo || libro.grupo || "default", lineas, resumen };
}
