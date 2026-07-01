# ingesta-02 — Adapter daños/edificios (terremotovenezuela.com)

**Tipo:** AFK

## What to build

Completar el adapter `terremotovenezuela.js` (hoy stub tolerante, "forma exacta por confirmar")
contra la API implícita `/api/public/media/reports/`: descubrir el shape real del endpoint una vez,
fijarlo, y emitir `Registro` categoría `dano` con geo + foto + severidad. Es la capa geo nueva (704
edificios, 188 colapsos) — F2 del plan. Complementa (no reemplaza) el `hub damaged_building`.

## Acceptance criteria

- [ ] `fetchRegistros()` trae los edificios/reportes reales del endpoint (no vacío).
- [ ] `normalize()` mapea a `{categoria:"dano", payload:{severity, place, photoUrl}, coords:{lat,lng}}`.
- [ ] Registro sin geo → `coords:null` (fuera del mapa, al directorio).
- [ ] Licencia: atribuir a terremotovenezuela.com si se publica; si no hay licencia clara → interno.
- [ ] `node --test` verde; test de `normalize` con un reporte sintético.

## Blocked by

None - can start immediately.
