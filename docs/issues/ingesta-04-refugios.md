# ingesta-04 — Adapter refugios/albergues (acopios-refugios)

**Tipo:** AFK

## What to build

Adapter para `acopios-refugios` → `Registro` categoría `refugio`: dónde se aloja la gente
desplazada (albergues, refugios). Categoría nueva (aún no hay builder de refugios — ver TODO en
`run.js`). F3 del plan. Distinguir refugio (alojamiento) de centro (acopio) aunque la fuente los
mezcle.

## Acceptance criteria

- [ ] `fetchRegistros()` trae refugios reales con ubicación.
- [ ] `normalize()` → `{categoria:"refugio", payload:{nombre, direccion, capacidad?, contacto}, coords}`.
- [ ] `buildRefugios` wired a `BUNDLES` en `run.js`; escribe `data/bundles/refugios.json`.
- [ ] `node --test` verde; test de `normalize`.

## Blocked by

None - can start immediately.
