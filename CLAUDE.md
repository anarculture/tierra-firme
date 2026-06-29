# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Tierra Firme — bot de WhatsApp para la crisis sísmica VE (24-jun-2026). Centraliza reenvíos
crudos (texto/voz/foto/captura) y los destila en demanda estructurada: **qué hace falta, dónde,
cuánto**. No es fuente oficial. El norte de producto y el anti-scope viven en `TIERRA-FIRME.md`
(léelo antes de cambios de alcance); el porqué de las decisiones, en `docs/adr/`.

## Comandos

```bash
npm test                          # node:test — debe estar verde (es el gate)
node --test test/geocoder.test.js # un solo archivo de test
npm run build                     # valida que los JSON declarativos parseen (scripts/build.js)
npm run dev                       # levanta API + web en :8787 (src/api/server.js)
npm run ingest                    # corre los adaptadores → data/bundles/*.json
npm run destila                   # inbox del día → borradores de sitrep (LLM)
npm run revisar                   # panel del operador (compuerta humana)
node scripts/analiza.js           # inbox → necesidades/ofertas/gaps/alertas

# Buzones Python (corren standalone; selftest = gate sin red):
python3 ingest/whatsapp_buzon.py --selftest   # cubre el path de firma HMAC
python3 ingest/telegram_buzon.py --selftest
```

CI (`.github/workflows/ci.yml`) corre exactamente `node --test` + el selftest del webhook WhatsApp.
No hay lint configurado.

## Restricción dura: sin dependencias externas

Vanilla JS + Node stdlib (`type: module`, Node ≥20) en `src/`+`scripts/`; Python stdlib en `ingest/`
(excepción: `faster-whisper` en `.venv` para `transcribe.py`). **No agregues una dependencia npm/pip
para lo que unas líneas de stdlib resuelven.** Las deps (p.ej. `@supabase/supabase-js`) se cablean
solo cuando una capa concreta las usa. Esto es deliberado: corre en red mala, server-light.

## Dos stacks, dos pipelines (no los confundas)

El repo mezcla Python y JS porque son **dos pipelines distintos** que se cruzan en un solo punto.

**1. Colector (índice/espejo, read-only) — JS.** `src/ingest/run.js` orquesta adaptadores que
solo *leen* fuentes externas (`fetchRegistros() → Registro[]`, contrato en `_adapter.js`) y escriben
`data/bundles/<categoria>.json`. `src/api/server.js` los sirve por `/api/<nombre>` (curado en
`src/curated/` primero, luego bundle). **Aquí nunca se escribe a la fuente.** Las fuentes son
declarativas en `sources.manifest.json` (la lista) — los adaptadores las implementan.
- Resiliencia: `run.js` envuelve cada fetch en `safe()`; si una fuente falla, degrada a bundle vacío
  y sigue. El gate real es el test de normalize de cada adapter, no la red.

**2. Sensor de demanda (el bot) — Python intake + JS destilación.** El loop central:
`reenvío → buzón → inbox JSONL → destila (LLM) → dedup+geocode → compuerta humana → salida`.
- Buzones (`ingest/whatsapp_buzon.py`, `ingest/telegram_buzon.py`) escriben **el mismo** contrato:
  una línea JSONL por mensaje en `ingest/inbox/<YYYY-MM-DD>.jsonl` (`{ts,from,kind,text,media}`,
  definido en `ingest/inbox.py`). El destilador no distingue canal — ese es el único acoplamiento
  entre los dos stacks. `ingest/inbox/` es **gitignored (PII)**.
- `scripts/destila.js` lee ese inbox → `data/sitrep-drafts.json`; el operador aprueba en
  `npm run revisar`. **Nada público sin que un humano lo verifique** (regla no negociable).

## Reglas de licencia y PII (críticas, no obvias)

- **PII (nombres/teléfonos/ubicación de personas vivas) nunca sale a la salida pública.** El inbox
  y `data/missing.json`/`patients.json`/`puntos_ayuda_live_db.csv` están gitignored; al servir se
  redactan o se gatean (`TF_API_KEY`). El system prompt de `destila.js` lo refuerza.
- **Licencia de fuentes determina dónde se publica.** Las fuentes del *hub* federado
  (`src/ingest/hub.js`) no declaran licencia → **captura interna, NO se publica en `/v1`**. Por eso
  `run.js` separa `demanda.json` (source aliado con permiso → publicable) de `demanda-hub.json`
  (hub, interno). No mezcles un source sin licencia en un bundle publicable: lo serviría bajo la
  atribución de otro. Ver los comentarios en `run.js:47-67` y `hub.js`.

## Notas de configuración

- Dos destiladores LLM con default distinto: `scripts/destila.js` (borradores de sitrep) usa
  **Ollama/Qwen local** por default (PII no sale del VPS), endpoint OpenAI-compatible — cambias de
  proveedor con env vars (`DESTILA_BASE_URL/MODEL/API_KEY`). `ingest/destilador.py` (eco por-mensaje)
  usa **Gemini** (`gemini-2.5-flash-lite`, endpoint nativo `generateContent`).
- `whatsapp_buzon.py` exige `WA_APP_SECRET` (verificación de firma HMAC) salvo `--dev`. El panel
  `revisar` se gatea con `REVISAR_TOKEN` (HTTP Basic) antes de tunelizar.
- `.env` lo lee `server.js` con un parser stdlib propio; solo expone URL + publishable key al
  navegador, nunca la secret.

## Convenciones del repo

- Worktrees del flujo multi-agente van en `.claude/worktrees/`; `main` es solo coordinador
  (ver `docs/WORKFLOW.md`). No trabajes features directo en `main`.
- Los `TODO(Sx)` marcan trabajo diferido a un slice futuro — son scaffolding intencional, no bugs.
- Comentarios `ponytail:` marcan simplificaciones deliberadas con su techo/upgrade path.
