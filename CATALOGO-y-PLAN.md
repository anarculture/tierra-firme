> ⚠️ **HISTÓRICO — borrador de la era monitorVE (modelo índice/mapa).** El producto actual es
> **Tierra Firme**; el plan vigente está en **[TIERRA-FIRME.md](TIERRA-FIRME.md)**. Se conserva
> el catálogo de fuentes como referencia.

# Catálogo de fuentes + Plan — Sistema informativo crisis terremoto VE (24-jun-2026)

_Borrador 2026-06-26. Basado en crawl directo + sistemas probados en zonas de crisis._

---

## 0. Tesis

El ecosistema de información de esta crisis ya existe, pero **fragmentado en 10+ sitios**
que recolectan lo mismo por separado, sin dedup entre ellos, sin procedencia visible,
sin API común. Una familia que busca un desaparecido debe revisar 4 registros distintos.

**Nuestro rol más útil no es recolectar de nuevo — es AGREGAR, DEDUPLICAR, DESTILAR y
ABRIR.** Una capa de consolidación + un tablero situacional + una API abierta que
haga converger al ecosistema en vez de sumar un sitio aislado más.

Referencia conceptual: `worldmonitor` (tablero de situational awareness). Pero su
arquitectura (TS/Vite, globe.gl, deck.gl, 500+ feeds, protobuf, AI synthesis, app de
escritorio Tauri) está **enormemente sobre-construida** para una respuesta de crisis que
debe salir en días. Tomamos el concepto, no el peso.

---

## 1. Catálogo de fuentes (ecosistema detectado)

| Sitio | Categoría | Qué ofrece | Stack / exposición | Procedencia / confianza |
|---|---|---|---|---|
| **terremotovenezuela.com** | Daños estructurales | Mapa interactivo de daños; 188 colapsos, 233 daños graves, 283 parciales, 704 edificios; reportes con fotos (≤8) | Cloudflare, SPA JS-render. OSM. | Comunitario, curado por 1 persona. **Hub de enlaces** a otras 7 webs. |
| **desaparecidosterremotovenezuela.com** | Personas desaparecidas | Registro de desaparecidos (~48k únicos / 61.8k crudos) | Next.js (app router) en S3/CloudFront. Data en chunks JS. | Comunitario. **21.8% duplicados + spam inyectado** (visto en auditoría de AyudaVE). |
| **acopiovenezuela.vercel.app** | Centros de acopio | Directorio de centros (≈158) | Next.js / Vercel. | Comunitario. Ya consumido por AyudaVE como fuente. |
| **ajevenezuela.org/ayuda-venezuela** | Canales de donación | 12 orgs verificadas (DVC, Alimenta la Solidaridad, UNICEF España, Save the Children, Intl Medical Corps, GoFundMe…), cuentas bancarias Mercantil/BNC, divisas Panamá/SWIFT; voluntariado | Vite SPA. | **Organización (AJE Venezuela)** — la fuente más institucional/verificada. Sin coords, sin cripto. |
| **ayudahumanitariavenezuela.com (AyudaVE)** | Meta-agregador | Centros + personas + hospitalizados + voluntarios + donaciones. **Ya dedup + auditoría + API REST `/api`** | Vanilla JS + Node/SQLite, Cloudflare/GCP. | El más maduro. Ya agrega acopio + desaparecidos + listas hospital. (Ver `REPORTE-ayudahumanitariavenezuela.md`.) |
| terremotovenezuela.**app** | Emergencia / desaparecidos | (enlazado, sin crawl) | — | Comunitario |
| venezuelatebusca.com | Desaparecidos | Registro de personas | — | Comunitario |
| venezuelareporta.org | Desaparecidos | Registro de personas | — | Comunitario |
| sismovenezuela.com | Mapa de calor consolidado | **Otro agregador** (heat map) | — | Comunitario |
| ayudavenezuela.app / ayudasismo.org | Ayuda de emergencia | Coordinación | — | Comunitario |

**Categorías de servicio en el ecosistema:** (1) daños estructurales · (2) personas
desaparecidas/encontradas · (3) hospitalizados/heridos · (4) centros de acopio · (5)
canales de donación verificados · (6) voluntariado · (7) albergues · (8) mapas de calor.
Casi nadie cubre las 8; cada quien hace 1-2. Nadie las unifica con procedencia.

> Fase 0 del plan = terminar este catálogo (crawl de las 5 sin analizar + buscar más).

---

## 2. Lo que enseñan los sistemas probados en crisis

Destilado de sistemas con trayectoria real (Haití 2010, Japón 2011, Nepal 2015, etc.):

| Sistema | Lección que adoptamos |
|---|---|
| **Ushahidi** (Haití, Kenia) | Intake multicanal (web/SMS/WhatsApp/redes) → mapa categorizado + **estado de verificación** por reporte (no verdad binaria). |
| **Google Person Finder** (Haití/Japón) | Esquema estándar **PFIF** ("busco a / tengo info de") + **dedup/merge de registros** + federación entre registros. Exactamente el problema de los 4 sitios de desaparecidos. |
| **Sahana Eden** | Módulos separados: albergues, personas, inventario, organizaciones. Registro de recursos/orgs. |
| **HDX / ReliefWeb (OCHA)** | **Procedencia + frescura** obligatorias; etiquetas estándar **HXL**; datos abiertos descargables. |
| **PetaBencana / PetaJakarta** | Mobile-first, **bajo ancho de banda**, confirmación ciudadana en tiempo real. Ligero. |
| **HOT OSM Tasking Manager** | OSM como capa base; coordinación de voluntarios sobre el mapa. |
| **CAP / FrontlineSMS** | Alertas en formato estándar; **degradar a SMS/USSD** para teléfonos básicos y redes caídas. |

**Principios no negociables que salen de ahí:**
1. **Procedencia siempre visible** — cada dato muestra de dónde salió y cuándo (`source`, `fetched_at`).
2. **Dedup + merge** — el mismo desaparecido/centro aparece N veces; consolidar (AyudaVE ya prueba la heurística por nombre normalizado).
3. **Verificación por niveles**, no binaria — `oficial / por-verificar / comunitario`.
4. **Frescura y caducidad** — el dato de crisis se pudre rápido; mostrar "actualizado hace X", expirar lo viejo.
5. **Mobile-first, low-bandwidth, offline** — el afectado está en red mala o sin red.
6. **Esquema interoperable + API abierta** — para que el ecosistema converja (lección PFIF/HXL), no para encerrar el dato.
7. **No hacer daño / minimizar PII** — desaparecidos + hospitalizados son sensibles. Sin cédula, sin Nº historia, con vía de takedown.
8. **Accionabilidad sobre volumen** — destilar "qué es vital AHORA" (5 cifras), no 500 feeds. (El error a evitar de worldmonitor.)

---

## 3. Arquitectura propuesta (mínima, estilo monitorVE)

No duplicar intake: los otros sitios ya recolectan. **Somos la capa de agregación.**
Patrón = colector programado → normaliza → dedup → sirve JSON estático + SPA ligera + API.

```
  Fuentes (10+ webs)                  COLECTOR (cron 15-30min)           SALIDA
  ─────────────────                   ──────────────────────             ──────
  acopiovenezuela      ─┐             adaptador por fuente               personas.json
  desaparecidos*.com   ─┤  fetch ──▶  → normaliza a esquema común ──▶    centros.json
  venezuelatebusca     ─┤             → dedup cross-source               donaciones.json
  venezuelareporta     ─┤             → tag {source, fetched_at,         danios.json
  ajevenezuela         ─┤                verification, coords}           hospitales.json
  terremotovenezuela   ─┘                                                + API /v1/*  + export CSV/HXL
                                                                              │
                                          SPA mobile-first (Leaflet/OSM) ◀────┘
                                          mapa + buscador unificado + tablero situacional
```

**Stack lazy (evita el peso de worldmonitor):**
- Front: **vanilla JS SPA** (igual que AyudaVE — probado, ligero, sin build) + Leaflet/OSM.
- Colector: scripts Node pequeños, uno por fuente, corriendo en **cron / GitHub Actions**.
- Almacén: **JSON estático en CDN/Pages** para empezar (sin BD). Subir a SQLite/Supabase solo si hace falta escritura. _ponytail: empieza estático, BD cuando el volumen lo exija._
- API: el mismo JSON servido público + un export. Sin protobuf, sin edge functions.

**Esquema común (núcleo, por categoría):**
- `persona`: id, tipo(desaparecido|encontrado|hospitalizado), nombre, edad, sexo, zona{estado,municipio,parroquia}, lugar, foto?, contacto?, **source, source_url, fetched_at, verification**.
- `centro`: id, nombre, tipo, dirección, coords, needs[], acepta[], contacto, **source…**.
- `donacion`: org, tipo(banco|movil|cripto|intl), datos, link_oficial, verificación, **source…**.
- `daño`: id, coords, nivel, fotos?, fecha, **source…**.

---

## 4. Plan por fases (días, no semanas — es crisis activa)

- **Fase 0 — Catálogo de fuentes (½–1 día).** Crawl de las 5 fuentes sin analizar + buscar más (redes, gob, ONGs). Salida: `sources.json` (registro vivo: categoría, URL de datos, formato, permiso/ToS, frescura). Es el corazón del sistema.
- **Fase 1 — Colector + normalización + dedup (2-3 días).** Un adaptador por fuente → esquema común → dedup cross-source (reusar heurística de AyudaVE). Salida: JSONs normalizados en cron.
- **Fase 2 — Tablero + front (2-3 días).** SPA mobile-first: tablero situacional (5 cifras vitales), mapa unificado, **buscador de personas cross-source** (la pieza de mayor valor), directorio de centros, panel de donaciones verificadas, daños. Offline (service worker). Badges de procedencia + frescura.
- **Fase 3 — API abierta + interop (1-2 días).** Publicar JSON como API + export CSV/HXL; mapear personas a **PFIF**. Ofrecerlo a las otras webs para frenar la fragmentación.
- **Fase 4 — Resiliencia/multicanal (si hay tiempo).** Bot WhatsApp/SMS de búsqueda de personas (low-bandwidth), alertas CAP, mirror estático.

---

## 5. Qué aportamos que hoy NO existe (el diferencial)

1. **Búsqueda de personas CROSS-source** — hoy cada registro está aislado; una familia revisa 4 sitios. Nosotros: un buscador, todos los registros.
2. **Dedup ENTRE fuentes** — AyudaVE dedup solo su fuente; nosotros entre desaparecidos*.com + venezuelatebusca + venezuelareporta + listas hospital.
3. **Procedencia + frescura visibles** en cada dato (lección HDX).
4. **API abierta + esquema estándar** — convergencia, no un silo más (lección PFIF/HXL).
5. **Destilación situacional** — "qué es vital ahora" arriba, no un muro de datos.

---

## 6. Riesgos y límites (no simplificar esto)

- **PII / no hacer daño**: agregamos desaparecidos y hospitalizados de fuentes públicas. Minimizar (sin cédula/historia), vía de takedown, no facilitar localización para hacer daño. Sensible legal y éticamente.
- **Permiso / ToS / robots**: scraping de terceros. Preferir **pedir feeds/colaboración** antes que raspar; algunos robots bloquean bots.
- **Calidad de origen (garbage-in)**: las fuentes traen 21.8% duplicados y spam inyectado. Dedup + verificación obligatorios; mostrar "sin verificar".
- **Responsabilidad**: info de emergencia errónea daña. Disclaimers + estado de verificación, como AyudaVE.
- **Sostenibilidad**: es específico de esta crisis, vida corta. No sobre-construir (Ponytail). Empezar estático, crecer solo si el uso lo justifica.

---

## 7. Dirección confirmada (decisiones tomadas 2026-06-26)

1. **Construir aparte.** Sistema propio (greenfield). **AyudaVE pasa a ser una FUENTE nuestra**: su `/api` ya mapeado (`/centers`, `/persons`, `/hospitals`, `/metrics`, `/audit` → todo JSON) es el feed más rico y estructurado del ecosistema. Federar/intercambiar si se puede.
2. **Tablero situacional + Directorio accionable** (ambos, UI-forward). La API abierta queda como subproducto, no como foco.
3. **Ambas audiencias por igual.** Núcleo ligero mobile-first/offline para afectados en VE + capa rica encima (mapa, donaciones intl, coordinación) para diáspora/respondedores. Progressive enhancement.

**Consecuencias para el build:**
- Front: SPA vanilla mobile-first + service worker (offline) como base; capa rica progresiva.
- AyudaVE `/api` = primer adaptador del colector (gratis, ya funciona). Resto de fuentes detrás.
- Mantener API/export abiertos para no encerrar el dato, pero sin invertir UI ahí todavía.

### Arranque inmediato — Fase 0
Terminar el catálogo: crawl de las 5 fuentes sin analizar (terremotovenezuela.app,
venezuelatebusca.com, venezuelareporta.org, sismovenezuela.com, ayudavenezuela.app/
ayudasismo.org) + confirmar exposición de datos de cada una → producir **`sources.json`**
(registro vivo de fuentes: categoría, URL de datos, formato, frescura, permiso). Es el
insumo directo de la Fase 1 (colector).
