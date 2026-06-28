# Integraciones del ecosistema

Specs **verificadas en vivo el 2026-06-28** (sondeo directo, no copiadas de doc viejo).
Tres piezas = una capa de respuesta para el bot: **acopiove = profundidad** (dato vivo),
**ruteo.json = amplitud** (handoff a las ~100 plataformas sin API), **ResponseGrid = salida**
(la demanda sensada sale por `POST /needs`).

---

## 1. acopiove — OFERTA (centros, refugios, teléfonos, personas)

- **Base:** `https://api.acopiove.org/v1` · read-only, **sin auth**, abierta.
- **OpenAPI:** `https://api.acopiove.org/v1/openapi.json` · docs `https://api.acopiove.org/v1/docs`
- **Licencia:** **CC-BY-4.0** — atribución: `Datos: AcopioVE (acopiove.org), CC-BY-4.0`
- **Volumen (live /meta):** 577 centros (544 acopios + 33 refugios, 20 países), 78 teléfonos.
- **Acceso:** UA de navegador normal. (Cloudflare puede dar 403 a UAs raras; `/docs` HTML da 403, la API JSON no.)

| Método | Ruta | Params | Para qué |
|---|---|---|---|
| GET | `/puntos` | `tipo, ciudad, pais, near, radius, format, limit, offset` | Directorio unificado (acopios+refugios), geo |
| GET | `/centros` | `tipo, ciudad, estado, pais, recibe, near, radius, bbox, updatedSince, format, limit, offset` | Centros de acopio/refugio (dato rico) |
| GET | `/centros/{id}` | `id*, format` | Un centro |
| GET | `/telefonos` | `ciudad, pais, limit, offset` | Teléfonos de emergencia |
| GET | `/personas` | `q, cedula, estado, limit` | **Búsqueda** de personas (no listado; requiere `q`≥2 o `cedula`) |
| GET | `/meta` | — | Conteos, licencia, atribución |
| POST | `/submissions` | (body) | Sugerir un punto (contribución de terceros) |
| GET | `/submissions/{id}` | `id*` | Estado de una sugerencia |

Envelope: `{ "data": [...], "meta": {...} }`.

Campos clave:
- **centros:** `id, name, tipo, estado(abierto/…), address, ciudad, pais, lat, lng, recibe[], necesita_ahora, horario, contacto, responsable, fuente, updated_at`
- **puntos:** `id, tipo, nombre, lat, lng, ciudad, pais, estado, categorias[], telefono, descripcion, fuente, fuente_url, actualizado_en`
- **telefonos:** `id, name, number, description, ciudad, pais, updated_at`
- **personas:** `id, nombre, estado(desaparecido/…), edad, ubicacion_general, foto, cedula, fuente, fecha` — proxy a desaparecidosvenezuela.com / SOS Venezuela (PII; es búsqueda, no volcado).

---

## 2. ResponseGrid — DEMANDA (needs, offers, resources)

- **Base:** `https://api.responsegrid.app` · reads **sin auth**, writes **Bearer (JWT)**.
- **Licencia:** **CC-BY-SA-4.0** — *share-alike viral*. Atribución obligatoria:
  `ResponseGrid by Global Emergency, licensed under CC BY-SA 4.0 — https://responsegrid.app`
  ⚠️ Mezclar esta data obliga a tu obra derivada a CC-BY-SA-4.0 también.
- **Emergencia VE:** `id=11111111-1111-4111-8111-111111111111`, `slug=terremoto-venezuela-2026`, `country=VE`, `status=active`.

| Método | Ruta | Params / Auth | Para qué |
|---|---|---|---|
| GET | `/emergencies` | — | Lista emergencias activas |
| GET | `/emergencies/by-slug/{slug}` | — | Resolver por slug |
| GET | `/emergencies/{id}/public/resources` | `page, limit(≤100,def50), category, country` | Puntos verificados/oficiales |
| GET | `/emergencies/{id}/public/resources/facets` | — | Conteos por categoría/país |
| GET | `/emergencies/{id}/public/needs` | `priority(low/medium/high/urgent), category` | Necesidades validadas |
| POST | `/emergencies/{id}/needs` | Bearer | Crear necesidad (**← salida del bot**) |
| POST | `/emergencies/{id}/offers` | Bearer | Registrar oferta material |
| POST | `/emergencies/{id}/resources` | Bearer | Registrar punto logístico |
| POST | `/auth/register` | — | Crear cuenta → `accessToken` |

Envelope paginado: `{ items, total, page, limit }`.

---

## 3. Mapeo intent del bot → fuente

| Intent (categoría ruteo) | Respuesta |
|---|---|
| Acopios / Donación física | 🟢 acopiove `GET /centros?recibe=X&near=` (dónde llevar, qué urge) |
| Albergues / refugios | 🟢 acopiove `GET /puntos?tipo=refugio&near=` |
| Teléfonos / Oficial | 🟢 acopiove `GET /telefonos` |
| Desaparecidos | 🟡 acopiove `GET /personas?q=` + handoff a registros grandes de `ruteo` |
| Hospitales / Edificios / Donación $ | 🔵 handoff `ruteo.json` (sin API propia) |
| (demanda sensada en WhatsApp) | 🟢 `POST` ResponseGrid `/needs` |

---

## 3b. crisisvenezuela (crisis-pulse) — FEED SITUACIONAL, no directorio

- **Base:** `https://crisisvenezuela.org/api/v1/facts` · read-only, sin auth, **CC-BY-4.0**
  (atribución: `crisisvenezuela.org + fuentes originales`). Formatos: json / geojson / csv.
- **Verificado en vivo 2026-06-28:** 10,935 hechos. Params: `categoria, estado, municipio, nivel,
  tipo_necesidad, bbox, desde, min_fuentes, fuente, excluir_fuente, limite, offset, formato`.
- **Naturaleza (verificado, importante):** NO es un directorio estructurado. Cada "fact" es
  **texto libre** (`descripcion`) de una fuente (tweet/web), con **procedencia** (`fuentes[]` con URL)
  y **corroboración** (`n_fuentes`). Campos: `id, categoria, nivel, municipio, estado, zona,
  lat, lon, descripcion, tipo_necesidad, atrapados, n_fuentes, fuentes[], fecha`.
  - `categoria` es **flexible y ruidosa**: `acopio` incluye noticias mal-tageadas (ej. "equipos USAR
    de Murcia"); `daño` mezcla daño estructural con menciones sísmicas. Pocos traen coords.

**Qué tomamos (decisión):**
- ✅ **Solo `categoria=daño&min_fuentes=2`** (843 hechos) → alimenta `bundles/danos.json`,
  reemplazando a terremotovenezuela (que da 503). Adaptador: `src/ingest/crisisvenezuela.js`
  (primario en `buildDanos`, terremoto de fallback). Preserva `descripcion/nFuentes/fuentes`.
- ❌ **`acopio`** → NO. Es texto libre, no centros usables; **acopiove** ya da el directorio
  estructurado (name/address/recibe/contacto). Solape parcial de fuente (acopiovzla.com, RefugioVE…)
  pero sin estructura que aporte.
- ❌ **`necesidad`** → NO por ahora. Solapa nuestros `reports` **a nivel de evento** (mismo hecho,
  distinto registro, sin llave para dedup). Es más completo/corroborado, pero requiere diseño de
  merge-por-evento antes de ingerir.

**Futuro (anotado):** es la mejor **capa de conciencia situacional + corroboración** disponible
(qué se reporta, con cuántas fuentes, con qué links). Útil para `/sitrep` y contexto NL del bot,
NO para respuestas de directorio. Lección para manejar data de este tipo: **clave = corroboración
(`n_fuentes`) + procedencia (`fuentes[]`)**, y el reto = **dedup por evento** entre fuentes sin ID común.

---

## 3c. Ayuda Venezuela Red — DEMANDA estructurada (baja confianza)

- **Base:** `https://ayuda-venezuela-red.vercel.app/api` · read-only, **sin auth**. Next.js/Vercel.
- **Verificado en vivo 2026-06-28:** `GET /api/zonas` (29 zonas) + `GET /api/necesidades` (323, enum
  `categoria`: rescate/agua/medicinas/alimentos/higiene/ropa/refugio; `prioridad` urgente/alta).
  `GET /api/envios` vacío. Join limpio `necesidades.zona_id → zonas.id`.
- **Naturaleza:** es la **otra punta del ruteo** — DEMANDA (zonas afectadas + qué necesitan), y a
  diferencia de crisisvenezuela viene **estructurada** (enums, cantidades). Complementa acopiove (oferta),
  no lo solapa.
- ⚠️ **Dos candados (verificados):**
  1. **Escrituras abiertas sin auth** (`OPTIONS` permite POST/PUT/DELETE) → crowdsourced **no verificado**.
  2. **Sin licencia declarada** (ni ToS ni CC en el sitio).
- **Geo:** solo 2/29 zonas traen lat/lng; el resto tiene estado/municipio/ciudad → geocodeable con
  nuestro loop (follow-on, aún no aplicado).

**Qué hacemos (decisión):**
- ✅ **Captura** → `src/ingest/ayudaredve.js` alimenta `bundles/demanda.json` (`buildDemanda`),
  cada zona con sus necesidades embebidas y `payload.verificado=false` (leads sin confirmar).
- ✅ **Publicado en `/v1/demanda`** — el operador es **aliado y dio permiso explícito**; se sirve con
  atribución (`Ayuda Venezuela Red, con permiso`). Sirve al bot y a otros consumidores del API.
- ⚠️ Sigue marcada **`verificado=false`** en cada registro (escrituras abiertas en origen): son leads,
  no se funden con datos verificados sin esa marca de procedencia.

---

## 4. Relación con nuestro API público (`data/api.py`)

- **`/v1` nuestro** = publica NUESTROS snapshots (índice/espejo, CC-BY-SA-4.0). `GET /v1/ruteo` ES la tabla de handoff.
- **acopiove / ResponseGrid** = fuentes vivas que el bot consulta directo (no las espejamos; profundidad/salida).
- Regla: dato vivo si la fuente tiene API; si no, handoff vía `ruteo`. El bot nunca dice "no sé".
