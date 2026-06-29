> ⚠️ **HISTÓRICO — tracker local de la era monitorVE; no se mantiene.** La fuente de verdad son
> los GitHub Issues (ver [docs/WORKFLOW.md](docs/WORKFLOW.md)); el plan actual está en
> **[TIERRA-FIRME.md](TIERRA-FIRME.md)**.

# ISSUES — monitorVE (slices tracer-bullet)

Tracker local (sin remoto). Derivado de `ROADMAP.md` vía `/to-issues`. Cada slice se ejecuta con
`/lazy-fable`. Marcar `[x]` al cerrar (gates verdes + commit).

Estado: ✅ hecho · ⬜ pendiente · 🔸 = HITL.

---

## ✅ A2 · Geocoding de centros  (hecho — commit e16fb27)
168/175 centros con coords (fallback centroide-estado; Nominatim opcional `GEOCODE_NOMINATIM=1`).

---

## ✅ M1 · Bottom-sheet móvil con Feed
**Tipo:** AFK · **Blocked by:** ninguno.
**Qué construir:** En móvil (≤860px) el mapa va a pantalla completa y aparece una hoja inferior
arrastrable que contiene el feed de réplicas; en desktop no cambia nada (rieles + feed a la derecha).
Un solo render: `renderFeed` parametrizado por contenedor.
**Acceptance:**
- [ ] En móvil: rieles ocultos, mapa full, `#sheet` visible con handle + feed dentro.
- [ ] Hoja con alturas peek/half/full (tap en handle cicla; opcional drag).
- [ ] Desktop intacto (rieles + feed en `#right`).
- [ ] `renderFeed(target)` sirve a ambos; helper puro `nextSheetState()` con test failable; `node --check` + serve OK.

## ✅ M2 · Capas y detalle en móvil
**Tipo:** AFK · **Blocked by:** M1.
**Qué construir:** En móvil, el control de Capas se abre como overlay y el detalle de un marcador se
muestra en la hoja; KPI header compacto. Reusar `capasHtml`/`wireCapas` scopeados a contenedor.
**Acceptance:**
- [ ] Botón "Capas" (móvil) abre overlay con toggles + choropleth, funcional.
- [ ] Tap en marcador → detalle en la hoja (no en riel oculto); back vuelve al feed.
- [ ] Sin IDs duplicados entre desktop y móvil (scope por contenedor); `node --check` + serve OK.

## ✅ M3 · Jitter/cluster de marcadores aproximados
**Tipo:** AFK · **Blocked by:** ninguno (mejora a A2).
**Qué construir:** Los centros geocodificados a centroide-de-estado se apilan (~17 puntos para 168).
Dispersar (jitter determinista por id) o agrupar (cluster con conteo) para que el mapa sea legible;
marcar visualmente los de confianza baja distinto de los exactos.
**Acceptance:**
- [ ] Centros con `confidence:'baja'` no se apilan en un punto (jitter o cluster).
- [ ] Estilo distinto para aproximados vs exactos; tooltip aclara "ubicación aproximada (estado)".
- [ ] Helper de jitter puro + test failable (determinista por id).

## ✅ A3 · Heatmap de gaps
**Tipo:** AFK · **Blocked by:** ninguno (usa `needs`+`estado`, ya disponibles).
**Qué construir:** El choropleth deja de contar "nº de puntos" y pasa a mostrar **necesidad vs
cobertura** por estado: intensidad = necesidades reportadas no cubiertas; leyenda de gap.
**Acceptance:**
- [ ] Choropleth colorea por gap (necesidades vs centros/cobertura) por estado.
- [ ] Leyenda explica la escala; tooltip por estado con el desglose.
- [ ] Función de agregación de gap pura + test failable.

---

## ✅ B1 · Sitrep como fuente verificada  🔸HITL
**Tipo:** HITL (verificación humana antes de publicar) · **Blocked by:** ninguno.
**Qué construir:** Un sitrep (borrador del bot `/sitrep`, revisado por humano) se publica como
capa/feed propio con procedencia "monitorVE-verificado" — somos FUENTE, no solo agregador.
**Acceptance:**
- [ ] Un sitrep verificado entra como registros propios (categoría/feed) con `source:'monitorVE'`.
- [ ] Nunca se publica sin paso de verificación humana explícito.
- [ ] Visible en el feed/mapa con su procedencia.

## ✅ B3 · Confianza por ítem + "por qué no verificado"
**Tipo:** AFK · **Blocked by:** ninguno.
**Qué construir:** Cada dato mostrado lleva su nivel de confianza (oficial/org/comunitario/sin-verificar)
y, cuando aplica, la razón de no estar verificado.
**Acceptance:**
- [ ] Badge de confianza por ítem en feed/detalle/directorio.
- [ ] Razón visible cuando `sin-verificar`.
- [ ] Mapeo fuente→confianza puro + test failable.

## ⬜ B2 · Dedup + IDs canónicos (ADR 0001)
**Tipo:** AFK · **Blocked by:** slice Personas (traer ≥2 fuentes de personas — aún no creada).
**Qué construir:** Misma persona/centro en varias fuentes → 1 entidad canónica enlazada (no fusión);
sesgo a separar. Reusa `web/pip`-style puro + heurística de nombre.
**Acceptance:**
- [ ] Clúster confirmado vs posible según ADR 0001 (el demo "José Pérez" no colapsa sin edad).
- [ ] Conteos colapsan solo en confirmado; detalle muestra las N fuentes.
- [ ] Lógica de clustering pura + test failable (el demo de ADR 0001).

---

## ✅ F0 · Capa de escritura Supabase  🔸HITL
**Tipo:** HITL (requiere claves Supabase del dueño) · **Blocked by:** ninguno.
**Qué construir:** Cliente Supabase + esquema aplicado (`supabase/migrations/0001_schema.sql`) + env
(`.env`, sin hardcodear). Base para resolución y coordinación (C2/C3).
**Acceptance:**
- [ ] Cliente lee `SUPABASE_URL`/`SUPABASE_ANON_KEY` de `.env`.
- [ ] Migración aplicada (tablas sources/records/clusters/resolutions/curated + coordinación).
- [ ] Un write+read de prueba funciona; test/health failable.

## ✅ C1 · Needs board
**Tipo:** AFK · **Blocked by:** ninguno.
**Qué construir:** Tablero de necesidades sin cubrir por urgencia/zona, derivado de `needs`+`estado`
de los centros (solo-lectura primero). Es la vista que dispara la coordinación.
**Acceptance:**
- [ ] Lista de necesidades agregadas por tipo/urgencia/estado, ordenada por urgencia.
- [ ] Filtro por estado/tipo; conteo.
- [ ] Agregación de needs pura + test failable.

## ⬜ C2 · Voluntarios/recursos + matching manual
**Tipo:** AFK · **Blocked by:** F0.
**Qué construir:** Alta de voluntarios (skill/zona/disponibilidad) y recursos; un operador asigna
manualmente una necesidad a un voluntario/recurso (escribe en Supabase).
**Acceptance:**
- [ ] Registrar voluntario/recurso; listar y filtrar por skill/zona.
- [ ] Crear una asignación necesidad↔voluntario/recurso (estado 'asignada').
- [ ] Validación de input (rechaza incompleto); test failable.

## ⬜ C3 · Tasking + evidencia de entrega  🔸HITL
**Tipo:** HITL (liability → `/security-review`) · **Blocked by:** C1, C2.
**Qué construir:** Despachador real: asignación → en curso → **entregado con evidencia** (foto/confirmación)
+ log de accountability (timestamps) + consentimiento/disclaimer. No prometer lo que no llega.
**Acceptance:**
- [ ] Estados abierta→asignada→en_curso→entregada con timestamps registrados.
- [ ] Evidencia de entrega requerida para cerrar; consentimiento mostrado al voluntario.
- [ ] `/security-review` del diff antes de cerrar; test de la máquina de estados failable.

## ⬜ C4 · API abierta / export
**Tipo:** AFK · **Blocked by:** ninguno.
**Qué construir:** Exponer los bundles + export (CSV/HXL) para que otras webs consuman nuestra verdad.
**Acceptance:**
- [ ] `/api/export?cat=...` devuelve CSV/HXL válido de una categoría.
- [ ] Documentado (qué categorías, formato); test failable del export.

---

### Orden sugerido
Fase A: **M1 → M2 → M3 → A3** (paralelizables M1+A3). Fase B: B3, B1, (B2 tras Personas).
Fase C: F0 → C1 → C2 → C3 → C4.

## ✅ P1 · Panel de revisión + publicar (bot → sitreps)
**Tipo:** AFK · **Cierra el loop:** inbox → /sitrep (borrador → data/sitrep-drafts.json) → panel
operador (editar/aprobar) → publica a src/curated/sitreps.json → feed "Reportes verificados".
Servidor operador LOCAL aparte (`npm run revisar`, 127.0.0.1:8799); el público sigue read-only.
Reusa `merge()` (procedencia obligatoria, dedup titulo+zona, frescura). `applyPublish` testeado.
