# 09 — Foto → OCR → Necesidad (lista de insumos) o Compra (factura)

**Tipo:** AFK · **Track:** OCR (reusa `src/extract.js`)

## What to build

Aplicar el módulo VLM que ya existe (`src/extract.js`) a las dos entradas por foto (8a-iii de la
grilla), reusando la misma tecnología para ambos lados del libro:

- **Foto de lista de insumos** (necesidad) → ítems → Necesidad(es). Cierra el viejo problema de
  "lista detallada no especificada": los ítems reales (Catia = 47 apósitos, etc.) entran de verdad.
- **Foto de factura** (compra) → líneas `{insumo, cantidad, costo_unitario}` → Compra, **y guarda
  el adjunto de factura** para transparencia.

`ingest/enriquece.py` ya expone `enrich_record(..., vision_fn)`; cablear `extract.js` ahí.

## Acceptance criteria

- [x] Foto de lista de insumos → Necesidad con `items[]` real (sin placeholder "no especificada").
- [x] Foto de factura → Compra con líneas + costo + adjunto de factura guardado (interno).
- [x] Reusa `VLM_API_KEY` (fallback `ANALIZA_API_KEY`); sin nueva dependencia.
- [x] `node --test` cubre foto→Necesidad y foto-factura→Compra.

## Blocked by

- #01 — Necesidad: identidad + estado
- #02 — Compra: bitácora
