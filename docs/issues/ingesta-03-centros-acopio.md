# ingesta-03 — Adapter centros de acopio (centrosayudavenezuela)

**Tipo:** AFK

## What to build

Adapter para `centrosayudavenezuela.org` → `Registro` categoría `centro`: centros de acopio
buscables (dirección, contacto, ítems que reciben). Es el lado de la OFERTA (hoy el dump es casi
todo demanda/personas) — F3 del plan. Geocodificar vía `geocoder.js` si la fuente no trae coords
(mismo patrón que `buildCentros`/AyudaVE).

## Acceptance criteria

- [ ] `fetchRegistros()` trae los centros reales (dirección + ítems).
- [ ] `normalize()` → `{categoria:"centro", payload:{nombre, direccion, items[], contacto}, coords}`.
- [ ] Sin coords en la fuente → enriquecer con `geocoder.enrichCentros` (Nominatim opt-in + fallback estado).
- [ ] Wired a `buildCentros` (o builder propio) en `run.js`.
- [ ] `node --test` verde; test de `normalize`.

## Blocked by

None - can start immediately.
