# Reporte técnico — ayudahumanitariavenezuela.com (AyudaVE)

_Crawl: 2026-06-26. Solo recursos públicos (HTML, JS, CSS, endpoints GET abiertos)._

## 1. Qué es

SPA de coordinación de **ayuda humanitaria en Venezuela**, montada como respuesta al
**sismo de La Guaira del 24–25/06/2026** (terremoto reciente; región Vargas/La Guaira/Caribe).

Tres funciones núcleo:
1. **Centros de acopio** — directorio buscable, donaciones, verificación.
2. **Personas desaparecidas / encontradas** — reportes comunitarios + reunificación familiar.
3. **Personas en hospitales** — listas de ingresados tras el sismo, buscables por nombre.

Marca: "AyudaVE". Sin fines de lucro, data comunitaria, **explícitamente NO oficial**
(disclaimer en pantallas clave). Idioma: español. Colores = bandera Venezuela (escala azules, evita colores de partido).

## 2. Stack y hosting

- **Frontend**: SPA vanilla JS pura, sin framework, sin build. Router propio basado en objeto `screens{}` + pila `App.stack`.
- **Backend** (declarado en comentarios de `app.js`): **Node + SQLite**. API REST bajo `/api`.
- **Hosting**: Google Cloud (header `via: 1.1 google`) detrás de **Cloudflare** (`server: cloudflare`, `cf-ray`).
- **Mapas**: Leaflet (self-hosted en `/vendor/leaflet/`) con tiles OpenStreetMap + CartoCDN. Google Maps JS API opcional (solo si config trae key — hoy vacía).
- **Analytics**: GA4 vía GTM, opcional, **solo si `/api/config` devuelve `gaId`** (hoy vacío → analytics apagado). `anonymize_ip: true`, sin guardar IP.
- **Fuentes**: Plus Jakarta Sans (Google Fonts).
- **Seguridad headers**: CSP estricta, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `referrer-policy: strict-origin-when-cross-origin`.
- **robots.txt**: Cloudflare-managed. Bloquea bots IA (ClaudeBot, GPTBot, CCBot, Google-Extended, Bytespider, meta-externalagent, etc.). `Content-Signal: search=yes,ai-train=no`. **No hay sitemap.xml** ("No encontrado").

## 3. Estructura de archivos (todo estático servido en raíz)

| Archivo | Tamaño | Rol |
|---|---|---|
| `index.html` | 24 líneas | shell SPA, `<div id="root">`, carga 5 scripts |
| `styles.css` | 604 L / 34 KB | estilos |
| `vendor/leaflet/leaflet.{js,css}` | — | mapas |
| `data.js` | 224 L / 15 KB | **catálogos/constantes UI** (íconos, necesidades, skills, estados). NO datos reales |
| `geo-ve.js` | 27 KB | división político-territorial VE (24 entidades, municipios, parroquias). Fuente: `github.com/zokeber/venezuela-json` (Vargas→La Guaira) |
| `api.js` | 95 L | **capa cliente API** — todos los endpoints |
| `app.js` | 2364 L / 166 KB | router + ~50 pantallas + acciones + boot |

Versionado por query string `?v=1782433947` (cache-bust por timestamp de deploy).

## 4. De dónde se alimenta (DATOS)

Los datos reales NO están en el front; vienen del backend `/api`. Origen de cada dataset:

### a) Centros de acopio → importados de terceros
`GET /api/centers` devuelve objetos con `"source":"acopiovenezuela.vercel.app"`, `"imported":true`.
→ **Scrapea/importa de `acopiovenezuela.vercel.app`**. Hoy: **158 centros, 158 verificados.**
Campos: needs[] con nivel (crítica/alta/media/baja), accepts[], crypto[], coords, contacto, updates[], stats.

### b) Personas desaparecidas/encontradas → agregadas + deduplicadas
`GET /api/audit`: fuente declarada = **`desaparecidosterremotovenezuela.com`**.
- Total en fuente: **61.834 reportes** → **48.334 únicos**, **13.500 duplicados (21.8%)**, 1.020 grupos.
- Dedupe por **nombre** (ignora mayúsculas/acentos/orden apellidos + erratas con match de edad/zona). NO usa teléfono (es del reportante).
- Detecta basura: ej. top duplicado `"TRUSTEDF57 - infinityhotel.it"` con 10.067 copias (spam/inyección en la fuente).
- Listado público muestra **1 reporte por persona**; auditoría expone el conteo crudo.
- `GET /api/persons/stats` y `/api/metrics` dan cifras (oscilan entre llamadas → datos vivos, posiblemente muestreados): ~30k–55k personas, ~26k–46k desaparecidos.
- Usuarios también **crean reportes nuevos** vía `POST /api/persons` (formulario en la app).

### c) Personas en hospitales → listas de ingreso del sismo
`GET /api/hospitals`: **754 personas** en 10+ centros (Hosp. Campaña/Listas La Guaira, Pérez Carreño, Seguro Social La Guaira, Domingo Luciani, Periférico Catia, etc.).
- Cada registro: nombre, hospital, edad, sexo, lugar, motivo, confiabilidad (`oficial` | `por-verificar`).
- Origen mixto: listas oficiales de hospitales + lista "traumacheck" + reportes por verificar.
- Para reunificación familiar. **No publica cédula ni N° de historia.**

### d) Datos generados por la propia app (UGC)
Voluntarios (46), donaciones, postulaciones, centros nuevos, recursos, reportes de persona. Vía POST autenticados.

### e) Recursos (`/api/resources`) → hoy **vacío** `[]`. Grupos WhatsApp/Telegram, bases de datos, galería. Solo admin agrega.

## 5. API (cliente en `api.js`, base `/api`)

Auth: `Bearer token` en localStorage (`ayudave_session`). Login = **teléfono +58 + PIN 4 dígitos**.

**Públicos (GET)**: `/centers`, `/centers/:id`, `/donations?center=`, `/persons`, `/persons/stats`, `/persons/:id`, `/config`, `/metrics`, `/audit`, `/hospitals`, `/resources`, `/users/check?phone=`, `/volunteers/lookup?q=`.

**Escritura (POST/PATCH)**: `/centers`, `/centers/:id/updates`, `/donations`, `/volunteers`, `/applications`, `/persons`, `/persons/:id/sightings`, `/resources`, `/upload` (imagen dataURL→{url}), `/users`, `/users/login`.

**Admin/verificador**: `/admin/overview`, `/admin/dashboard`, `/admin/centers/:id` (status), `/admin/persons/:id` (ocultar), `/admin/resources/:id/delete`. Protegidos (401 si no admin).

Login tiene rate-limit (maneja 429).

## 6. Mapa de pantallas (~50, objeto `screens`)

- **Home**: hero, 4 stats vivos (centros / en hospitales / desaparecidos / localizados), banner alerta duplicados, 7 acciones, tiras de exploración.
- **Centros**: `centers-all`, `center-public`, `center-donate`, `donate-centers` (directorio por zona), `map-view` (Leaflet, centro Caracas 10.49,-66.87).
- **Donar**: flujo guiado `donate-what`→`donate-where`→métodos (`pagomovil`/`transferencia`/`cripto`/`fisico`/`voluntarios`)→`donate-upload`→`donation-status`.
- **Ayudar**: `help-location`→`help-how`→`help-reco` (recomendación por zona/aporte).
- **Voluntario**: `vol-skills`→`vol-data`→`vol-tasks`→`vol-panel`, login por teléfono.
- **Mi centro**: `my-centers`, `center-panel`, edición needs/inventory/methods, updates, solicitar voluntarios/transporte, cerrar.
- **Personas**: `persons-list` (tabs des/enc, búsqueda), `person-detail` (avistamientos, marcar encontrado), `person-type`→`person-create`→`person-done`.
- **Hospitales**: `hospitals` — búsqueda + chips por hospital, max 400 visibles.
- **Cuenta**: `login`, `register` (perfil + aportes), `passcode` (PIN).
- **Admin**: `admin`, `dashboard` (rangos), verificar centros, moderar personas.
- **Info**: `metrics`, `audit`, `resources`, `resource-new`, `search`, emergencias.

## 7. Boot

```
boot(): API.config() → initGA(gaId) → Promise.all[centers, persons, metrics, audit] → render()
```
Delegación de eventos global por `data-go` / `data-action` / `data-back` / `data-home`. Estado de sesión en localStorage (`ayudave_*`), caché de servidor en `DB{centers,donations,persons}`.

## 8. Métricas en vivo (snapshot del crawl)

```
visits: 3518 vistas tot / 625 hoy · 912 únicos / 191 hoy
centers: 158 (158 verificados)
persons: ~55.336 tot (45.808 desaparecidos / 9.528 encontrados)  [/metrics]
persons: ~30.489 tot (26.408 / 4.081)                            [/persons/stats — difiere, datos vivos]
volunteers: 46
hospitals: 754
```

## 9. Observaciones / banderas

- **Agregador, no fuente primaria**: depende de `acopiovenezuela.vercel.app` (centros) y `desaparecidosterremotovenezuela.com` (desaparecidos). Si esas caen o se ensucian, AyudaVE hereda el problema (ya mitiga con dedupe + auditoría visible).
- **Calidad de fuente mala**: 21.8% duplicados, spam inyectado (entrada de 10k copias). El sitio lo expone honestamente.
- **Discrepancia /metrics vs /persons/stats** en totales → cifras dinámicas/muestreadas o ventanas distintas; verificar antes de citar.
- **PII sensible**: nombres de hospitalizados/desaparecidos. Mitigan ocultando cédula/historia y con flag de confiabilidad, pero el dataset es delicado.
- **Seguridad app**: `esc()` para anti-XSS en inputs; pero hay HTML inyectado con interpolación en varias plantillas (`foto`, `url`, `descripcion` no siempre pasan por `esc`) — superficie XSS posible vía UGC. CSP mitiga (`script-src 'self' 'unsafe-inline'` — el `unsafe-inline` debilita).
- **Auth débil por diseño**: teléfono + PIN 4 dígitos (con rate-limit). Adecuado a contexto de emergencia/baja fricción, no a alta seguridad.

---
_Archivos crawleados guardados en scratchpad: `home.html`, `api.js`, `data.js`, `geo-ve.js`, `app.js`, `styles.css`._
