> ⚠️ **HISTÓRICO — modelo viejo de monitorVE (índice/mapa/despacho).** El producto actual es
> **Tierra Firme** (puerta WhatsApp = sensor de demanda + enrutado). El plan vigente está en
> **[TIERRA-FIRME.md](TIERRA-FIRME.md)**. Se conserva como referencia de la investigación que
> informó decisiones aún vigentes (geocoding Nominatim, móvil-first).

# monitorVE — Roadmap (síntesis 2026-06-26)

Plan sintetizado de 4 frentes de investigación (móvil · ayudave.com · geocoding · coordinación)
+ la decisión estratégica del dueño.

## Identidad (DECIDIDA)

monitorVE = **fuente informativa verificada + centro de coordinación y despacho.**
No agregador pasivo. El bucle de valor, dos días post-tragedia:

**centralizar → destilar → verificar → ALOCAR**

La investigación de competidores lo confirma: ayudave.com (daños/mascotas) y
ayudahumanitariavenezuela.com (acopios/donaciones) son equipos distintos, ambos crowdsourcing
**sin verificación, sin dedup, sin coordinación, sin análisis de gaps**. No se compite en
features — se compite en **confianza + coordinación**. Ventana: primeras 2–4 semanas.

## La cadena de valor (qué somos, capa por capa)

1. **Centralizar** — ingesta multi-fuente. _Tenemos:_ réplicas (USGS), centros (AyudaVE, 175), daños, epicentros, manifest de fuentes.
2. **Destilar** — dedup cross-source + IDs canónicos + el **sitrep bot como FUENTE de info nueva** (no solo consumir). Diferenciador #1.
3. **Verificar** — audit trail + niveles de confianza + "mostrar lo que NO se ve". _Tenemos:_ panel de salud de fuentes, procedencia/frescura. Diferenciador #2.
4. **Alocar** — necesidad → recurso/voluntario → asignación → tracking → entrega. El salto a despacho. + **API abierta** para que otras webs consuman nuestra verdad (federación).

## Hallazgos clave por frente

- **Móvil (R2):** patrón = **bottom-sheet + tab bar**. Mapa full siempre visible + hoja arrastrable (peek/half/full) con pestañas (Réplicas / Centros / Más), KPI header compacto, offline vía service worker. Desktop = los rieles actuales como modo amplio. Validado en PetaBencana, Ushahidi, Google Crisis Map.
- **Geocoding (R3):** **Nominatim** (gratis, sin key; su ToS exige cachear = justo lo nuestro) + **fallback a centroide de municipio** para direcciones débiles. Google/Mapbox descartados (ToS prohíbe almacenar coords / batch enterprise). Diseño: `geocoder.js` con caché + throttle 4 req/min; campos `coords{lat,lng,confidence,source}`.
- **Coordinación (R4):** MVP lazy = **needs board → matching manual → task board** (estados abierta→asignada→en curso→hecha + log de timestamps). Primitivas: necesidad / recurso / voluntario / asignación / tarea. Encaja sobre los `needs` de centros que ya agregamos. Riesgos: liability, do-no-harm, prometer-y-no-cumplir, duplicación, overcommit (todos con mitigación).
- **ayudave (R1):** 7 ángulos rankeados — top: dedup/IDs canónicos · audit trail · API abierta · heatmap de gaps · **pipeline verificado (crowd→sitrep→feed)** · **coordinación/asignación**.

## Secuencia de ejecución

**Fase A — Accesible + base territorial (AHORA, paralelizable):**
- **A1. Móvil-first** (bottom-sheet + tabs). Sin esto, la mayoría no usa el app. → R2.
- **A2. Geocoding de centros** (Nominatim + fallback municipio). Sin coords la coordinación territorial es ciega. → R3.
- **A3. Heatmap de gaps** (evolucionar el choropleth: necesidad reportada vs cobertura). → R1#4.

**Fase B — Destilar + verificar:**
- **B1. Pipeline de sitrep** (dump→sitrep→feed verificado): el bot como fuente nueva. _(skill /sitrep ya existe; produce BORRADOR, nunca publica solo)._ → R1#6.
- **B2. Dedup + IDs canónicos** (persona/centro = 1 entidad). → ADR 0001 + R1#1.
- **B3. Niveles de confianza / audit visibles.** → R1#2.

**Fase C — Alocar (coordinación/despacho):**
- **C1. Needs board** (necesidades sin cubrir, por urgencia/zona) desde los `needs` de centros.
- **C2. Registro de voluntarios/recursos** + matching manual.
- **C3. Tasking** (asignación→en curso→hecho + accountability).
- **C4. API abierta** (federar; otras webs consumen).

## Decisiones pendientes (tuyas)

1. **Móvil-first** — viramos default a teléfono (desktop = modo amplio). _Recomiendo sí; procedo salvo que digas no._
2. **Geocoding** — Nominatim gratis (cachea, cumple ToS). _Recomiendo sí; procedo salvo objeción._
3. **Alcance de "despacho" (la grande)** — ¿**matchmaker** (facilitamos: needs board + tasking manual, sin prometer entrega, con consentimiento + log) o **despachador real** (nos comprometemos a que el recurso llegue)? R4 advierte liability/do-no-harm. _Recomiendo arrancar matchmaker y endurecer si el equipo real lo soporta._
4. **Quién verifica** — la verificación humana (sitrep, asignaciones) necesita una persona/operadora. ¿Tenés equipo? Define el cuello de botella de la Fase B/C.

## Decisiones tomadas (2026-06-26)
- **Alcance despacho = DESPACHADOR REAL.** Fase C cierra el loop con **evidencia de entrega** +
  log de accountability + manejo de liability (consentimiento, do-no-harm, no prometer lo que no
  llega). Zona "nunca lazy": validación, seguridad, expectativas.
- **Móvil = ambos por igual.** Responsive serio desde un solo código: móvil = bottom-sheet+tabs,
  desktop = rieles (modo amplio). Mismo render, distinto layout.

## Cómo construimos
Traducir A/B/C a slices verticales (extender BUILD.md) y correr con `/lazy-fable`. Arrancar A1+A2
en paralelo (independientes). _acopiovenezuela ya retirado (regla "solo la source principal")._
