# BUILD.md — monitorVE (orden de trabajo autónoma)

Sos un **desarrollador autónomo**. Construí TODO el código faltante vos solo, issue por
issue, sin pedir confirmación. Las decisiones de producto están **congeladas** (abajo). Tu
trabajo es llenar los stubs `TODO(Sx)` del scaffold hasta que el proyecto arranque y el smoke
manual pase. Loopéa cada issue con **`/lazy-fable`**.

> Reposo: el scaffold ya existe y compila. NO lo refundes. Mapeá → implementá → gate → commit.

---

## 0. SSOT — leé esto primero (una vez)

Estos archivos del repo son **ley**. Si tu código los contradice, el bug es tuyo:
- `CONTEXT.md` — glosario y leyes de estructura.
- `docs/adr/0001-clusteres-sesgo-a-separar.md` — identidad/dedup.
- `docs/adr/0002-direccion-de-diseno.md` — diseño (dark minimalist).
- `CATALOGO-y-PLAN.md` — catálogo de fuentes y arquitectura.
- `sources.manifest.json` — Fuentes (qué aporta cada una, cómo expone el dato).
- `web/styles.css :root` — **única fuente** de color/espacio. `web/MAP.md` — spec del mapa.

## 1. Decisiones congeladas (no las re-litigues)

1. **Somos índice/espejo, no sistema de registro.** Las otras webs son *Fuentes*; read-only sobre ellas.
2. **Única intake = Señal de resolución** ("esta persona ya apareció"). Nada más se escribe del lado usuario.
3. **Capa propia = clústeres de dedup + resoluciones + entradas curadas.** Sin correcciones de dato ajeno, sin alta de personas nuevas.
4. **Persona** = sujeto con estado `desaparecida`→`localizada`. **Reportante** = contacto aparte (no dedup por teléfono). **Hospitalizado** = una *Localización*.
5. **Clúster: enlazar, no fusionar; sesgo a separar** (ADR 0001). `Match confirmado` (nombre idéntico + edad/zona) vs `Match posible` (no colapsa). Cruce *desaparecida×localización* = siempre manual.
6. **Posicionamiento:** `venezuelareporta.org` se **federa** (no se re-agrega). Diferencial = el superset de mando.
7. **Stack:** vanilla JS sin build + Node stdlib + JSON estático para lectura + Supabase solo para la Capa propia (escritura). Cero deps que el stdlib resuelva.
8. **Diseño (ADR 0002):** minimalist dark base · acentos brutalist en el command-center · soft solo en superficies de diáspora · **sin globo 3D** (mapa = SVG estados + Leaflet/CARTO dark).
9. **Procedencia + frescura obligatorias:** todo dato mostrado lleva `source` + `fetched_at`/`verificado_el`. Cifras siempre con **fecha+fuente+rango**, nunca un absoluto que insinúe conteo oficial.
10. **PII:** no replicar cédula en claro aunque la Fuente la exponga. Vía de takedown = dejar de espejar.
11. **Anti-confabulación ("sume, no reste"):** solo Fuentes verificadas. Las de `sources.manifest.json → excluidas` (Tilin/Centinela/Habitable/Pacientes-Terremoto-Vzla/fvivemas-como-localizador/Alimenta-pausada) **no se incluyen** sin re-verificar.

## 2. Antes de tocar código (una vez)

- `npm install` (hoy sin deps). Node ≥20.
- Verificá los gates en verde: `npm run build`, `npm test`, `npm run dev` (→ http://localhost:8787), `npm run ingest`.
- Para slices con escritura (Supabase): añadí `@supabase/supabase-js`, aplicá `supabase/migrations/0001_schema.sql`, y leé `SUPABASE_URL`/`SUPABASE_ANON_KEY` de `.env` (nunca hardcodear claves).
- Sin repo fuente que portar: los datos vienen de las URLs del manifiesto (fetch en vivo en `ingest`) o de seeds inline de este documento (curados).

## 3. Protocolo de loop por issue (`/lazy-fable`)

Por cada `Sx` en orden:
1. **Stage (corto, escrito):** los 2–5 archivos a tocar + el check mecánico que lo prueba.
2. **Implementá lo más lazy que cumpla el AC.** Reusá lo existente, cero abstracciones nuevas, no agregues deps si lo instalado alcanza.
3. **Gate failable:** corré el check del issue + `npm run build` + `npm test`. Tiene que poder fallar de verdad.
4. **Verde** → marcá `[x]` acá + commit `Sx: <slice>`. **Rojo** → arreglá.
5. **2 fallas seguidas** → PARÁ, anotá bajo `## BLOQUEADO`, seguí con el siguiente issue no-bloqueado.

**Directivas de esta corrida (obligatorias):**
- **Todo slice con UI** (S0, S1, S2, S3, S4, S5, S6, S7, S8, S10, S12, S13): implementá la UI con **`/ui-ux-pro-max` como motor**, **dirigido por `docs/adr/0002` + tokens de `web/styles.css`**. Nada de color/espacio ad-hoc — usar las variables. Sin globo 3D.
- **`output-skill` activo en TODOS los issues:** entrega completa, **cero placeholders / comentarios "// resto aquí"**. Si un slice queda a medias, no está verde.
- **Frescura/procedencia en cada vista:** todo ítem renderiza su `source` + "actualizado hace X".

## 4. Gates duros (HITL) — review antes de cerrar

- **S6 (donaciones — dinero)**, **S8 (personas — PII)**, **S10 (resolución — escritura/datos)**: tras quedar verde, corré **`/security-review`** sobre el diff del slice **antes** de marcar `[x]`.
- **Contradicción real entre specs** → PARÁ y preguntá. No inventes para que pase un test. Nunca debilites un invariante de §1 para aprobar un check.

---

## 5. Issues (slices verticales, en orden de dependencia)

> Cada check es mecánico (test `node:test` o `curl`+grep que puede fallar). El pulido visual lo
> garantizan ui-ux-pro-max + output-skill y se valida en el smoke global (§6).

### [x] S0 — Shell + sistema de diseño + Panel vital  *(rails de: app, design, api-curado)*
- **Objetivo:** app dark navegable con los 6 pilares + Panel vital de urgencia 100% funcional (tap-to-call). Cero red.
- **Archivos:** `web/app.js` (router + 6 pantallas), `web/index.html`, `web/styles.css` (extender componentes con ui-ux-pro-max sobre los tokens), `src/curated/panel-vital.json` (poblar), `src/api/server.js` (servir cualquier `src/curated/*.json` por `/api/<nombre>`).
- **Seed Panel vital (inline, verificado):** `171` CANTV · `911` Movistar · `112` Digitel · `*1` Movilnet · Protección Civil `0800-5588427` / `0800-2668446` · Bomberos UCV `(0212)605-2222` · Bomberos La Guaira `(0212)332-7620`. Cada uno: `{titulo, contacto, categoria, fuenteOrigen:"investigación/Protección Civil", verificadoEl:"2026-06-26"}`.
- **AC:** dark mode aplicado; navegación entre pilares funciona; panel muestra los contactos con `tel:`/links; cada tarjeta muestra fuente+verificadoEl.
- **Check:** `node:test` asserta que `panel-vital.json` tiene ≥7 items y cada uno trae `titulo,contacto,fuenteOrigen,verificadoEl`; `curl -s localhost:8787/api/panel-vital` devuelve esos items.

### [x] S1 — Réplicas en vivo  *(rails de: colector→bundle→api)*
- **Objetivo:** widget de réplicas en el tablero: contador + últimos sismos + pronóstico OAF (curado).
- **Archivos:** `src/ingest/sismosve.js` (fetch+normalize), `src/ingest/run.js` (correr adapter → escribir `data/bundles/replicas.json`), `src/api/server.js` (servir bundles), `web/app.js` (pantalla tablero/réplicas), `src/curated/replicas-oaf.json` (nuevo: ~95% M5+, 40% M6+, fuente USGS, fecha).
- **AC:** `npm run ingest` baja de `sismosve.rafnixg.dev/api/sismos/recent` y escribe el bundle; tablero muestra contador + lista; OAF se muestra como Entrada curada con fecha+fuente; respaldo USGS FDSNWS documentado en el adapter (TODO si falla SismosVE).
- **Check:** `node:test` sobre `normalize(fixtureSismosVE)` → `Registro` (categoria `replica`, coords, fetchedAt); `curl /api/replicas` devuelve `items` array. (El fetch en vivo es smoke, no el gate.)

### [ ] S2 — Mapa nivel 1: choropleth SVG de 24 estados  *(rails de: mapa país)*
> NOTA: la **consola situacional** (ADR 0003) ya entrega el mapa Leaflet+CARTO dark con
> **marcadores tipados por capa** (epicentros/réplicas/acopios/daños/refugios/hospitales),
> toggles+conteo+frescura, feed, detalle al click y salud de fuentes. Falta de S2: el
> **choropleth por estado** (severidad) y el **modo offline SVG**.
- **Objetivo:** mapa del país interactivo, dark, offline (sin tiles).
- **Archivos:** `web/estados.svg` (paths de los 24 estados, dominio público/OSM), `web/app.js` (pantalla mapa + bind intensidad), `web/styles.css` (usar escala de severidad).
- **AC:** SVG tiñe cada estado por intensidad desde un agregado (réplicas/daños/centros por estado); tap → resumen del estado; **a11y: mostrar el valor, no solo color**.
- **Check:** `node:test` de la función `intensidadPorEstado(bundle)` → mapa `{estado: nivel}` determinista sobre fixture; el SVG referencia los 24 ids de estado.

### [ ] S3 — Daños estructurales  *(feeds: choropleth + lista)*
- **Objetivo:** capa de daños desde `terremotovenezuela.com/api/public/media/reports/`.
- **Archivos:** `src/ingest/terremotovenezuela.js` (nuevo adapter), `src/ingest/run.js`, `web/app.js` (lista/resumen daños + alimentar S2).
- **AC:** bundle `data/bundles/danos.json`; tablero muestra cifras (colapsos/severos/parciales) con fecha+fuente; el choropleth de S2 usa daños como intensidad.
- **Check:** `node:test` de `normalize(fixtureDanos)` → `Registro` categoria `dano`; `curl /api/danos` devuelve items.

### [ ] S4 — Directorio: Centros de acopio  *(rails de: directorio + Leaflet nivel 2)*
- **Objetivo:** directorio buscable de centros + pines en mapa-detalle (Leaflet/CARTO dark, lazy-load).
- **Archivos:** `src/ingest/acopiovenezuela.js`, `src/ingest/ayudave.js` (centros), `src/ingest/centrosayudavenezuela.js` (nuevo), `src/ingest/run.js`, `web/app.js` (directorio + Leaflet diferido), `web/MAP.md` (cumplir).
- **AC:** bundle `centros.json` (unión de las 3 fuentes, cada registro con `source`); directorio filtra por estado/municipio; pines en Leaflet **solo** al abrir mapa-detalle; cada centro muestra fuente+frescura.
- **Check:** `node:test` de `normalize` de cada fuente → forma `Registro` categoria `centro`; `curl /api/centros` devuelve items con campo `sourceId`.

### [ ] S5 — Refugios / albergues
- **Objetivo:** capa de refugios reutilizando los rails de directorio+mapa.
- **Archivos:** `src/ingest/acopios-refugios.js` (nuevo; fuente `por-verificar` → verificá primero), `src/ingest/run.js`, `web/app.js`.
- **AC:** si la fuente verifica, bundle `refugios.json` + capa en mapa/directorio. Si no verifica → `## BLOQUEADO` con la razón (no inventar refugios).
- **Check:** `curl /api/refugios` devuelve items **o** el issue queda bloqueado documentado.

### [ ] S6 — Donaciones (verificadas)  **[HITL: /security-review — dinero]**
- **Objetivo:** panel de canales de donación verificados.
- **Archivos:** `src/curated/donaciones.json` (poblar), `web/app.js` (pantalla donaciones, vibe soft/diáspora permitido aquí).
- **Seed (inline, verificado):** **Cáritas Venezuela** (Provincial `0108 0032 31 0200000492`, Mercantil `0105 0699 92 1699059454`, BNC `0191 0001 49 210101260010`, JP Morgan Brooklyn acct `41563002`, PayPal, RIF J-30485697-0) · **DVC "Fuerza Venezuela"** (info@dividendovoluntario.org; acopio Torre Seguros Sudamérica, Chacaíto) · **We Love Foundation**+GoFundMe · intl: GlobalGiving (VE Relief Fund), Direct Relief, IRC, World Vision, UNICEF USA · **AJE Venezuela** (ajevenezuela.org/ayuda-venezuela). Cada uno con `confianza` + `linkOficial` + `verificadoEl`.
- **AC:** lista con cuentas/links exactos; etiqueta de confianza visible; advertencia "verificá por tus medios". **Excluir** Alimenta la Solidaridad (pausada).
- **Check:** `node:test` valida `donaciones.json` (cada item: `org, tipo, linkOficial, confianza, verificadoEl`); luego **`/security-review`** del diff (exposición de datos financieros) antes de `[x]`.

### [x] S7 — Catálogo de servicios
- **Objetivo:** servicios contacto-y-listo.
- **Archivos:** `src/curated/servicios.json` (poblar), `web/app.js` (pantalla servicios).
- **Seed (inline, verificado):** Telemedicina **Venemergencia TAP** `0212-822.1262` (24/7 gratis), `nueveonce.com` · Psicológico **Rehabilitarte** (Lun-Mar `0424-6270439`, Mié-Jue `0414-9610311`, Vie-Sáb `0424-6077865`), **FUNDAINIL** (PsicoMapa UCAB) · Estructural **UNIMET @fceunimet** (Instagram; fuenteOrigen = imagen del usuario) · Transporte **Tu Gruero** (`tugruero.com`).
- **AC:** catálogo por tipo (telemedicina/psico/estructural/transporte), cada uno con su método de contacto exacto + fuenteOrigen + verificadoEl.
- **Check:** `node:test` valida `servicios.json` (≥6 items, cada uno con `tipo,titulo,comoContactar,fuenteOrigen,verificadoEl`).

### [ ] S8 — Personas: búsqueda cross-source (sin dedup)  **[HITL: /security-review — PII]**
- **Objetivo:** un buscador único sobre personas de varias Fuentes (el diferencial #1, primera mitad).
- **Archivos:** `src/ingest/ayudave.js` (persons+hospitals), `src/ingest/desaparecidos.js`, `src/ingest/run.js`, `web/app.js` (buscador + ficha persona).
- **AC:** bundle `personas.json` (con `estado`, `source`); búsqueda por nombre/zona devuelve resultados de todas las fuentes; ficha NO muestra cédula; cada resultado con fuente+frescura. Hospitalizado = Localización (no especie aparte).
- **Check:** `node:test` de `normalize` de cada fuente → `Persona`/`Registro` (sin campo cédula expuesto); `curl /api/personas?q=...` filtra. Luego **`/security-review`** (PII) antes de `[x]`.

### [ ] S9 — Dedup: clústeres persona×localización  *(núcleo del diferencial)*
- **Objetivo:** agrupar reportes de la misma persona entre fuentes (ADR 0001).
- **Archivos:** `src/dedup/index.js` (`normalizeName`, `buildClusters`), `web/app.js` (mostrar clúster: "mismo reporte en N fuentes" / "¿posible misma persona?").
- **AC:** sesgo a separar; `Match confirmado` colapsa, `Match posible` no; cruce *desaparecida×localización* siempre posible; no usa teléfono.
- **Check (el famoso):** `node:test` con `demo()` — `{"José Pérez",8,"Catia"}` vs `{"Jose Peres",null,"Catia"}` → **Match posible, NO colapsa**; añadir `{"José Pérez",8,"Catia"}` idéntico → `Match confirmado`. Falla si fusiona de más.

### [ ] S10 — Resolución (única intake) + Supabase  **[HITL: /security-review — escritura/datos]**
- **Objetivo:** marcar "ya apareció" → estado `localizada`.
- **Archivos:** `src/resolucion/index.js` (`markResolved` → Supabase), `web/api.js` (`markResolved` cliente), `web/app.js` (botón en ficha), `supabase/migrations/0001_schema.sql` (aplicar `resolutions`).
- **AC:** la marca escribe en `resolutions` (Supabase), NO muta la Fuente; la persona pasa a `localizada` y baja el perfil; claves Supabase desde `.env`.
- **Check:** `node:test` de la validación de input de `markResolved` (rechaza sin recordId/clusterId); smoke: marcar resuelve y la UI refleja. Luego **`/security-review`** (escritura) antes de `[x]`.

### [ ] S11 — Federación venezuelareporta  *(probable BLOQUEADO)*
- **Objetivo:** integrar el agregador maestro vía feed acordado (no scrape).
- **Archivos:** `src/ingest/venezuelareporta.js`.
- **AC:** si hay feed/acuerdo (hola@buscados.org) → adapter. Si no → `## BLOQUEADO` (depende de outreach humano). No scrapear sin permiso.
- **Check:** adapter con `node:test` de normalize **o** bloqueo documentado.

### [ ] S12 — Mascotas
- **Archivos:** `src/ingest/huellascan.js` (nuevo), `web/app.js`. Reusa rails de directorio.
- **Check:** `curl /api/mascotas` devuelve items **o** bloqueo documentado.

### [ ] S13 — Pulido anti-slop: frescura, disclaimers, fact-check
- **Objetivo:** pasada final de procedencia/frescura en TODA vista + banner disclaimer (no oficial) + enlace a Factchequeado/cotejo.
- **Archivos:** `web/app.js`, `web/styles.css`.
- **Check:** `node:test`/grep que cada bundle servido incluye `fetched_at`; smoke visual con ui-ux-pro-max.

### [ ] S14 — Offline + API abierta/export
- **Objetivo:** `web/sw.js` cache-first del app-shell + último bundle; export `/api/export` (CSV/HXL) de los datos públicos.
- **Archivos:** `web/sw.js`, `src/api/server.js`.
- **Check:** segunda carga funciona sin red (smoke); `curl /api/export?cat=centros` devuelve CSV.

---

## 6. Done global

Terminó **solo** cuando: todos los issues `[x]` (o en `## BLOQUEADO` con razón), `npm run build` y
`npm test` verdes, `npm run dev` arranca, y el **smoke manual** del `README` pasa de punta a punta
(tablero con réplicas, buscar persona cross-source, marcar resuelto, ver panel vital y servicios,
mapa del país). Cada vista muestra fuente+frescura. Cero placeholders.

## 7. Reglas que no se rompen (de §1)

Índice/espejo · única intake=resolución · capa propia={clusters,resolución,curadas} · enlazar-no-fusionar
con sesgo a separar · procedencia+frescura en cada dato · sin cédula en claro · cifras con fecha+fuente+rango ·
solo tokens de diseño (sin ad-hoc) · sin globo 3D · sin deps que el stdlib resuelva · solo Fuentes verificadas
(respetar `excluidas`). Si algo no cuadra con esto, el bug es tuyo, no del invariante.

## BLOQUEADO
_(vacío — el agente anota acá lo que falle 2 veces o dependa de outreach humano)_
