# 10 — Maps links por Necesidad (lista pública recortada)

**Tipo:** AFK · **Track:** Operación

## What to build

Link a Google Maps por Necesidad con lugar mapeable en la lista pública recortada, por búsqueda de
nombre (`maps/search/?query=<lugar>+<zona>`, sin coordenadas). Skip cuando no es mapeable
("General", "varias ubicaciones", zona sin lugar).

Sin geocoding ni coords (el repo tiene `src/ingest/geocoder.js` + cache si algún día se quieren).
Cambio chico del front de la vista pública (#05).

## Acceptance criteria

- [ ] Cada Necesidad pública con lugar mapeable muestra un link a Maps por `<lugar>+<zona>`.
- [ ] Lugares no mapeables no muestran link.
- [ ] Sin coordenadas, sin nueva dependencia.

## Blocked by

- #05 — Lista pública recortada
