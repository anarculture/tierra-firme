# ingesta-01 — Watermark incremental para Encuéntralos (personas)

**Tipo:** AFK

## What to build

El adapter `encuentralos.js` hoy hace un pull COMPLETO (~107k, ~1000 requests) en cada corrida
(`ponytail:` marcado en `buildPersonas`). Añadir ingesta incremental: persistir un watermark por
fuente (último `creado` visto / offset alcanzado) y traer solo lo nuevo desde entonces, mergeando
con el bundle previo en vez de re-bajar todo. Es el patrón §6 del `docs/PLAN-agente-ingesta.md`.

## Acceptance criteria

- [ ] `fetchRegistros({since})` trae solo registros con `creado > since` (o por offset), no las 107k.
- [ ] El watermark se persiste entre corridas (archivo local en `data/bundles/` o `.state`).
- [ ] La segunda corrida seguida hace ≪ requests que la primera (verificable por conteo de páginas).
- [ ] `safe()` sigue degradando a bundle previo si la fuente cae; sin perder lo ya ingerido.
- [ ] `node --test` verde; un test cubre el filtro incremental de `normalize`/selección.

## Blocked by

None - can start immediately (el adapter base ya existe).
