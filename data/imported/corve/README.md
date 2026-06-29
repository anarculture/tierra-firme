# Importado de `corve` — CUARENTENA (verificar antes de usar)

Origen: repo `corve` ("Venezuela Relief App"), vibecodeado por un tercero. **No es
de confianza y NO se trata como Fuente en vivo** — solo como **donante de datos**.
Tomamos activos estáticos, no la arquitectura ni una conexión a su sistema.

Regla: nada de acá entra a producción sin verificación + procedencia explícita
(`verificado: ⏳` hasta confirmar). Coherente con el modelo índice/espejo de monitorVE (era previa a Tierra Firme).

## Activos y su estado

### `acopios-caracas-chronicle.md`
- Lista de centros de acopio por estado/dirección/operador.
- Fuente original: Caracas Chronicle (IG), independiente del vibecoder.
- ✅ **VERIFICADO** — Caracas Chronicle es buena data (decisión del usuario, 26-jun).
- ⚠ Solo ~5 filas — semilla, no lista completa. Ampliar con más fuentes. Slice de acopios (S4).

### `venezuela-estados.min.geojson`
- Fronteras de los 24 estados/entidades (FeatureCollection, 25 features).
- ✅ **Simplificado y listo**: 13 MB → 277 KB (mapshaper `-simplify 4% keep-shapes`,
  precision 0.0001). El raw de 13 MB se borró (reproducible desde `corve-main.zip`).
- Uso: fallback offline del mapa, para no depender de geoBoundaries (API externa inestable).
- Caveat menor: quedaron ~1.759 auto-intersecciones tras simplificar; cosméticamente OK
  para un choropleth. Si aparecen artefactos en bordes, re-simplificar a 2–3%.

### `categorias.md`
- Taxonomía de categorías de ayuda (prioridad/color/icono). Vocabulario de diseño.
- Sin riesgo de confianza. Reusar para mapear necesidad/servicio en la destilación del bot.

## Qué NO tomamos de corve
Stack (Express/Socket.io/Redis/PostGIS/Docker), capas de usuarios/auth/matching/rutas.
Son de coordinación/registro — filosofía opuesta al índice/espejo. Twilio SMS: guardar
para el degrade-a-SMS futuro (S14), no ahora.
