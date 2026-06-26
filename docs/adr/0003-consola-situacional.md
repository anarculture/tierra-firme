# Front = consola situacional centrada en el mapa (no directorio)

**Contexto.** La primera UI (lista de pilares) se leía como una app "vibe-coded" más, no
agregaba sobre las plataformas existentes. El objetivo es una superficie de *situational
awareness* estilo worldmonitor / "como lo haría Palantir": el mapa ES la app y todo orbita la
entidad seleccionada.

**Decisión.** El **mapa de Venezuela a pantalla completa** (Leaflet + CARTO dark, vendorizado)
es el home. Sobre él: **marcadores tipados por `_kind`** (epicentro, réplica, acopio, daño,
refugio, hospital) — cada tipo con símbolo/color propio; **capas toggleables** (capa apagada = 0
fetches) con **conteo + frescura** por capa; **barra de estado** con KPIs de crisis; **feed de
inteligencia** (últimas réplicas) y **detalle de entidad** al click; **panel de salud de fuentes**
("mostrar lo que NO podés ver": fresh/stale/caída). Densidad sobre estética. Extiende ADR 0002
(dark, tokens, **sin globo 3D** — mapa plano).

**Adaptación de worldmonitor a la crisis.** Capas = nuestras categorías; índice/choropleth por
severidad de estado (futuro); anillos de exposición alrededor de los epicentros; degradación
elegante: **útil con cero datos** (sandbox sin red) mostrando capas vacías + estado de fuentes,
nunca pantalla en blanco.

**Consecuencia.** Las pantallas previas (Panel vital, Servicios) pasan a **overlays** desde la
consola; no se pierden. El choropleth de estados (ADR previo) queda como capa futura. Tiles
requieren red del navegador; el modo offline (SVG estados) es mejora posterior.
