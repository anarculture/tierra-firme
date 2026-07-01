# 08 — VLM batch import: los 37 ítems ya extraídos → needs.json

**Tipo:** AFK
**Estado:** ✅ DONE — `scripts/vlm-import.js` + `test/vlm-import.test.js`. 6 necesidades de fotos
mergeadas a `data/analisis-2026-06-29.json` → `publica.js` → `site/needs.json` (17 necesidades).
Catia/Luciani con ítems reales; OFERTA y comprobantes (PII) descartados; bolsas POR DECIDIR
preservado; `node --test` 32→39 verde (vlm-import aporta 7). Falta solo **deploy** (push gh-pages = decisión humana).

## What to build

Un importador one-shot que toma los ítems ya extraídos en
`cleaner/media-vlm/resultados-vlm.json` (batch de 42 fotos) y los lleva a
`site/needs.json` **pasando por la compuerta existente** (`scripts/publica.js`),
sin re-procesar fotos ni tocar el flujo del grupo (mínima fricción).

Hoy esos ítems viven desconectados: el sitio muestra *"lista detallada no
especificada en el volcado"* para Catia / Pérez Carreño mientras los ítems reales
(p.ej. Domingo Luciani = Hibiclen/Glutaraldehído/Multizim) ya están en el JSON.

Contrato de mapeo (VLM item → necesidad):
- **Filtro de correctitud (no lazy-skippable):** solo `relevant:true` **y**
  `kind == "NECESIDAD"`. Los 20 `kind=OFERTA` (ferretería Damasco) y los
  `relevant:false` (comprobantes/cotizaciones/hoja de cuentas con Bs/USD) se
  descartan — una oferta NO es una necesidad, y los comprobantes cargan PII.
- Agrupar por `destino` → `lugar` (limpiar el paréntesis "(recibe Dr. …)").
- `articulo` (+ `cantidad`/`unidad` si hay) → `items[]` como strings
  (ej. `"Glutaraldehído al 2% (1 Galón)"`).
- `zona`/`urgencia`: la foto no los trae → default sensato (zona derivada del
  lugar o `"Caracas"` si es hospital conocido; urgencia `"media"`). El operador
  ajusta en el draft antes de publicar.
- `reportes`: nº de fotos que aportan a ese lugar.

Salida al **draft** que `publica.js` ya lee (`data/analisis-<date>.json`),
mergeando con lo que haya (no clobber). Publicar = correr `publica.js` (gate
humano existente). Nada nuevo de infra.

## Acceptance criteria

- [ ] El importador lee `resultados-vlm.json` y produce necesidades SOLO de items `relevant:true` + `kind=NECESIDAD`.
- [ ] Ningún item `OFERTA` ni `relevant:false` (comprobante/cotización) llega a la salida.
- [ ] Cada necesidad cumple el schema que valida `test/necesidades.test.js` (`zona/lugar/items[]/urgencia∈{alta,media,baja}/reportes≥1`).
- [ ] Tras `publica.js`, Catia y Pérez Carreño (y Domingo Luciani) muestran ítems reales, no "no especificada".
- [ ] Merge en `data/analisis-<date>.json` no pisa necesidades ya existentes.
- [ ] `node --test` verde; un test cubre el mapeo, incl. que OFERTA/relevant:false NO se cuelan.
- [ ] Sin nueva dependencia (Node stdlib).

## Blocked by

None - can start immediately.
