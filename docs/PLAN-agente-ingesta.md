# Plan — Agente autónomo de ingesta multi-datapoint

**Objetivo:** un agente que, en un ciclo autónomo, consuma *cada* datapoint disponible del
ecosistema crisis-VE, lo normalice a un registro tipado, lo deduplique, aplique los gates de
PII/licencia, y emita el dump unificado + eventos accionables — **nada público sin compuerta humana.**

## 0. Principios (heredados del repo, no negociables)

- **Reusa lo que hay.** Colector `src/ingest/run.js` (orquesta adapters, `safe()` degrada a bundle
  previo si una fuente cae) + contrato `src/ingest/_adapter.js` (`fetchRegistros() → Registro[]`) +
  mi pipeline `data/imported/hospitales-sismo/{merge,dedup,audit,buscar}.py`.
- **Sin deps nuevas.** Node stdlib + Python stdlib. LLM (Gemini, ya cableado en `destila.js`) solo
  para transformaciones sucias — nunca para fetch ni dedup.
- **Determinista por defecto.** Adapters y dedup son código, no prompts: baratos, repetibles, auditables.
- **Gates duros:** PII y licencia (§5). **Compuerta humana** (`npm run revisar`) antes de todo output público.

## 1. Catálogo de datapoints (qué consume)

| categoría | fuente(s) | exposición | cadencia | PII | licencia | estado |
|---|---|---|---|---|---|---|
| persona · desaparecido | Encuéntralos (`/api/personas?q=`, agrega Reconexión+VzlaTeBusca) | API JSON | 30 min | sí | interna | **✓ ingerido** |
| persona · encontrado | Encuéntralos `estado=encontrado` | API JSON | 30 min | sí | interna | ✓ (36k) |
| persona · hospitalizado | buscatupaciente (Firebase), listas hospital (foto→OCR), ayudave `/api` | JSON / imagen | 1–6 h | sí | interna | ✓ parcial |
| centro · acopio | centrosayudavenezuela, acopiovenezuela, ayudave | SPA/API | 6 h | no | por-verificar | pendiente |
| refugio · albergue | acopios-refugios | mapa | 6 h | no | por-verificar | pendiente |
| daño · edificio | terremotovenezuela.com (`/api/public/media/reports/`), sosvenezuela2026 | API implícita | 6 h | no | atribuir | pendiente |
| réplica · sismo | usgs (fdsn geojson), sismosve (FUNVISIS), emsc | API JSON | 1–5 min | no | pública | pendiente |
| donación | aje, caritas | HTML | 24 h | no (orgs) | atribuir | pendiente |
| mascota | huellascan | SPA | 12 h | no | atribuir | pendiente |
| oferta | terremotovenezuela.**app** (hub federado) | API JSON | 30 min | no | interna | adapter `hub.js` ✓ |
| desinformación | factchequeado | RSS/HTML | 12 h | no | enlazar | pendiente |

## 2. El loop del agente

```
scheduler (cron por refresh_minutes de cada fuente)
 └─ para cada fuente habilitada:
      adapter.fetchRegistros()      # safe(): si falla → conserva bundle previo, sigue
        → normalize(categoría)      # → Registro tipado {id, categoria, campos, _fuente, _pii}
        → dedup(categoría)          # identidad por tipo (§4)
        → gate(PII, licencia)       # → {publicable | interno | requiere-humano}   (§5)
        → emit                      # interno: data/bundles/<cat>.json · público: src/curated/
    → watermark por fuente          # último `creado`/offset → próxima corrida es incremental
    → diff vs corrida previa        # emite EVENTOS accionables (§6)
```

## 3. Contrato de adapter — cómo domar cada realidad

Cada adapter declara `{categoria, exposicion, refresh_minutes, licencia, pii}` y expone
`fetchRegistros()`. Recetas por tipo de exposición (ya vistas en este ecosistema):

- **API JSON limpia** (Encuéntralos, usgs, hub) → fetch paginado directo. El más fácil.
- **SPA Next.js** (desaparecidos.com, VenezuelaTeBusca) → leer `/_next/data/**.json` o el XHR que
  hidrata la vista, NO el HTML. Si no hay endpoint estable → **preferir el agregador que ya lo
  federa** (Encuéntralos ya trae el 61% de Reconexión con mejor API — ver `data-dump-personas`).
- **Cloudflare** (tebusca) → UA de navegador + backoff; si hay challenge JS → degradar a agregador.
- **API implícita** (terremotovenezuela.com `/api/public/media/reports/`) → descubrir el endpoint XHR una vez, fijarlo en el adapter.
- **Foto de papel** (listas hospital) → OCR con VLM/Gemini → texto → `import.py`. Único uso de LLM en ingesta.

## 4. Identidad y dedup (cross-source)

Reusa `dedup.py` (conservador — dato de vida o muerte):
- **personas:** cédula fuerte → **HMAC token** (no se guarda cruda, regla de `encuentralos_parser`);
  nombre solo con apellido y sin cédula en conflicto; `_confianza` marca cruces dudosos a revisión humana.
- **centros/edificios:** identidad geo = `(round(lat,4), round(lng,4))` + dirección normalizada.
- **sismos:** event id nativo (usgs `us…`).
- **lineage:** cada registro lleva `_fuentes[]` **y el backend de origen** (descubrimos que el host de
  la foto revela el origen real: reconexion-api vs venezuelatebusca vs supabase). Esto permite auditar
  "¿de dónde nació este dato?" y no re-espejar orígenes ya federados.

## 5. Gates duros

- **PII** — nombres/teléfono/cédula de personas vivas **nunca** al output público. Cédula → HMAC.
  Teléfono del reportante → **descartar** (nunca persistir). Todo `*.json/*.csv` de personas gitignored;
  al servir, redactado o gateado (`TF_API_KEY`). Scan pre-publicación (`api.py test` ya chequea fuga).
- **Licencia** — fuente sin licencia declarada → **interno, no `/v1`, no estampar como nuestro**
  (regla `run.js`: `demanda.json` publicable vs `demanda-hub.json` interno). Un source sin licencia
  jamás entra a un bundle publicable.
- **Compuerta humana** — nada público sin que un humano verifique (`npm run revisar`). Los desaparecidos
  y **fallecidos** nunca salen crudos a una familia sin revisión.

## 6. Autonomía real

- **Incremental, no re-espejo:** watermark por fuente (`snapshot_version` / último `creado` / offset).
  Encuéntralos crece ~cada minuto → traer solo lo nuevo, no las 107k cada vez.
- **Resiliencia:** `safe()` degrada a bundle previo; N fallos consecutivos de una fuente → alerta, no crash.
- **Eventos accionables** (el diff es el producto, no solo el dump): persona pasó `desaparecido→encontrado`;
  nuevo `fallecido`; nuevo colapso de edificio; nuevo acopio. Estos son los que disparan valor (aviso a familia, ruteo).

## 7. Rol acotado del LLM

Solo donde el determinismo no llega: (a) **OCR** de fotos de listas; (b) **destilar** texto libre de
WhatsApp → necesidad/oferta (`destila.js`); (c) **clasificar** categoría ambigua. Nunca fetch, nunca dedup.

## 8. Fases de rollout (tracer-bullet, cada una un slice vertical que sirve solo)

1. **F1 · Personas incremental** — watermark sobre Encuéntralos (ya ✓) + añadir VenezuelaTeBusca (origen #2). Cierra la capa personas.
2. **F2 · Edificios/daños** — `terremotovenezuela.com` → capa geo nueva (704 edificios, fotos, colapsos).
3. **F3 · Oferta** — acopios + refugios. Hoy solo tenemos demanda; esto cierra demanda↔oferta.
4. **F4 · Livianas** — réplicas (usgs/sismosve), donaciones, mascotas, fact-check.
5. **F5 · Cross-layer join** — persona↔hospital↔edificio por geo/cédula. *El valor del ecosistema: no espejo, join.*

## 9. Verificación (gate real por adapter)

- Test de `normalize()` por fuente (el gate del repo, no la red).
- Selftest sin red por adapter.
- `audit.py` por bundle (completeness, dups, fallecidos).
- PII scan pre-publicación.

## 10. Anti-scope (qué NO hace)

- No espejar bases enteras de terceros sin licencia (interno o nada).
- No re-scrapear un origen si un agregador limpio ya lo federa (Encuéntralos > SPA de desaparecidos.com).
- No LLM donde stdlib basta. No adapters especulativos para fuentes que aún no rinden.
