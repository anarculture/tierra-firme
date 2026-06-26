# Mapa — spec (dirección: docs/adr/0002)

Dos niveles. **No** se usa globo 3D (globe.gl/deck.gl) — peso rechazado.

## Nivel 1 — Vista país: SVG choropleth de los 24 estados
- SVG inline de Venezuela (paths por estado). **Sin dependencias, sin tiles, offline, themeable.**
- Cada estado se tiñe por intensidad (daños / réplicas / nº centros) usando los tokens de
  severidad de `styles.css` (`--ok/--info/--warn/--crit`).
- Interacción: tap/hover en un estado → resumen (cifras + acceso a su detalle).
- **Accesibilidad:** no depender solo del color — mostrar el valor/etiqueta por estado.
- TODO(Sx): conseguir el SVG de estados (fuente OSM/dominio público), bindear `estado → intensidad`
  desde un agregado de `/api`.

## Nivel 2 — Zoom a pines: Leaflet + CARTO dark_matter
- Solo cuando se baja a ubicación real (centros de acopio, daños con coords).
- Tiles **CARTO dark_matter** (gratis, encaja con el dark; ya visto en CSP de AyudaVE).
- Leaflet ya está en el plan. Cargar de forma diferida (solo en la pantalla de mapa-detalle)
  para no penalizar el arranque en red mala.
- TODO(Sx): montar Leaflet con capa dark + pines por categoría (centro/daño/refugio).

## Notas
- Lazy-load del nivel 2; el nivel 1 es el default (más rápido, sirve el "mapa del país interactivo").
- Reusar la paleta/escala de `styles.css`; nada de colores ad-hoc.
