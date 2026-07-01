# 10 — Maps links por Necesidad (lista pública recortada)

**Tipo:** AFK · **Track:** Operación

## What to build

Link a Google Maps por Necesidad con lugar mapeable en la lista pública recortada, por búsqueda de
nombre (`maps/search/?query=<lugar>+<zona>`, sin coordenadas). Skip cuando no es mapeable
("General", "varias ubicaciones", zona sin lugar).

Sin geocoding ni coords (el repo tiene `src/ingest/geocoder.js` + cache si algún día se quieren).
Cambio chico del front de la vista pública (#05).

## Reconciliación con #05 / ADR 0006 (frontera PII)

La lista recortada es `zona+insumo+urgencia` (ADR 0006). El `lugar` para el link se añade
**solo para instituciones públicas** (`hospital`/`punto_apoyo`/`centro_acopio`) con nombre
mapeable — infraestructura pública, no PII. Destinos `doctor`/`persona` **nunca** exponen el
nombre (`lugarPublico()` devuelve null). No debilita ADR 0006: su regla dura es "detalle de
pacientes/contacto NO", y un nombre de hospital no es eso.

## Acceptance criteria

- [x] Cada Necesidad pública con lugar mapeable muestra un link a Maps por `<lugar>+<zona>`.
- [x] Lugares no mapeables no muestran link (genéricos como "General"/"varias ubicaciones", o destinos-persona).
- [x] Sin coordenadas, sin nueva dependencia.

## Blocked by

- #05 — Lista pública recortada
