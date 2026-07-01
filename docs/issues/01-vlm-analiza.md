# 01 — VLM→analiza: ítems de foto reales en needs.json

**Tipo:** AFK
**Estado:** ✅ DONE (versión lazy — sin puente JS↔Python)

## What to build

Hacer que las fotos del inbox EN VIVO lleguen a `site/needs.json` sin el placeholder
*"lista detallada no especificada"*.

**Hallazgo que cambió el scope:** `ingest/enriquece.py` YA convierte imagen→texto
(`_gemini_vision`) y lo mete a `rec["text"]`, que `analiza.js` (text-only) ya destila a
`{zona, lugar, items[], urgencia, reportes}`. O sea el path live foto→needs ya existía; solo
faltaba **correrlo en orden** — `enriquece.py` no estaba cableado en el flujo. Meter
`extract.js` (structured) dentro de `enriquece.py` NO gana nada: `analiza` aplana todo a texto
en la frontera `rec.text`, así que la estructura se perdería igual. Un puente JS↔Python sería
over-engineering; solo valdría si `analiza` pasara a consumir estructura directa (eso es #02/#03).

Hecho:
- `npm run enriquece -- <fecha>` (wrapper de `ingest/enriquece.py`) en `package.json`.
- Orden documentado en `CLAUDE.md`: `enriquece → analiza → publica`.
- Red de seguridad en `analiza.js`: avisa si el inbox trae media SIN `enriched` (foto/voz que
  solo se vería por su caption → placeholders), apuntando a `npm run enriquece`.
- `VISION_PROMPT` ya pedía transcribir ítem-por-ítem → sin cambio.

## Acceptance criteria

- [x] Foto del inbox → texto vía `enriquece.py` → `analiza` emite necesidad con `items[]` real (mecanismo existente, ahora en el flujo).
- [x] `analiza` avisa (no en silencio) si hay media sin enriquecer, señalando el fix.
- [x] Orden `enriquece → analiza → publica` documentado + `npm run enriquece`.
- [x] Reusa `ANALIZA_API_KEY`/`VLM_API_KEY`; sin nueva dependencia.
- [x] `node --test` verde; `enriquece.py --selftest` verde.

## Blocked by

- #08 — VLM batch import (comparten el converter VLM item → necesidad).
