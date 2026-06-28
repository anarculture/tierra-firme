# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Tierra Firme** — WhatsApp bot for the Venezuela seismic crisis (M7.2/M7.5 doublet, 24-jun-2026).
People forward raw chaos (chains, voice notes, photos, screenshots); the bot distills it into
structured demand (**what's needed, where, how much**) and routes what isn't its job to other
ecosystem tools. **Not an official source.** Read `TIERRA-FIRME.md` for the full product model.

Central loop: `forward → distill (LLM) → dedup + geocode → human gate → control tower / export`.
**Nothing goes public without a human approving it. PII (names/phones) never reaches public output.**

## Commands

```bash
npm test                 # node --test — discovers test/*.test.js. The merge gate; must stay green.
npm run destila          # scripts/destila.js — inbox/<date>.jsonl → data/sitrep-drafts.json (LLM)
npm run revisar          # scripts/revisar-server.js — operator review panel (the human gate), binds 127.0.0.1
npm run ingest           # src/ingest/run.js — fetch external sources → data/bundles/*.json (centro catalog)
node scripts/analiza.js  # inbox → demand/supply/gaps/alerts analysis (internal, not published)
```

Every Python module and most JS scripts have a failable `--selftest` (no network) that is the unit gate:
```bash
python3 ingest/whatsapp_buzon.py --selftest    # also run in CI (HMAC signature path)
python3 ingest/telegram_buzon.py --selftest
node scripts/destila.js --selftest
```

**No npm dependencies** — vanilla JS + Node stdlib, `node >= 20` (CI uses 22). Don't add a dep without
a layer that needs it. Python is stdlib-only except voice transcription (`faster-whisper` in `.venv`).
CI (`.github/workflows/ci.yml`) runs `node --test` + the webhook selftest on every push/PR.

## Architecture

One pipeline: Python intake feeds a shared inbox; JS scripts distill, an operator approves, and only
then it publishes. There is **no** public read-only web server.

### Intake → distill → gate → publish (the product)

- **`ingest/` (Python)** — channel collectors, all writing the **same** inbox contract.
  - `inbox.py` — shared contract: one JSONL record `{ts, from, kind, text, media}` per message in
    `ingest/inbox/<YYYY-MM-DD>.jsonl`; media → `inbox/media/`. **`inbox/` is gitignored — it holds PII.**
  - `whatsapp_buzon.py` — Meta Cloud API webhook (:8788, needs public HTTPS tunnel). **Requires
    `WA_APP_SECRET` (HMAC signature) unless run with `--dev`** — without it, anyone with the tunnel URL
    can inject into the inbox.
  - `telegram_buzon.py` — long-poll bot (no public endpoint needed).
  - `wa_to_inbox.py` — converts a WhatsApp `_chat.txt` export into the same inbox JSONL.
  - `destilador.py` / `responder.py` / `reply.py` — outbound reply layer (echo + acopio queries),
    **gated off by default** (`REPLY_ENABLED`). Replying is a public outbound action — keep it off until trusted.
  - `transcribe.py` — voice → text (faster-whisper, es-VE).
- **`scripts/` (JS)** — the distillation + publish chain over the inbox.
  - `destila.js` — `inbox/<date>.jsonl` → `data/sitrep-drafts.json` (LLM-distilled drafts). Reuses
    `src/ingest/geocoder.js` and `data/geocode-cache.json`.
  - `analiza.js` — same inbox → internal demand/supply/gaps/alerts (never published; feeds coordination).
  - `revisar-server.js` — **operator panel = the human gate**. Reviews drafts, publishes approved items
    to `src/curated/sitreps.json` (via `publica-sitrep.js`'s `merge`). Local by default; set `REVISAR_TOKEN`
    to require HTTP Basic before tunneling.
  - `publica-sitrep.js` — merges human-approved items into the public store. Enforces: `fuenteOrigen`
    required (provenance), `verificadoEl` auto-filled, dedup by `titulo`+`zona`, **zero PII**.
- **`web/`** — the operator review UI (`revisar.html` + `revisar.js`, served by `revisar-server.js`) and
  `styles.css`. `web/ve-estados.geojson` lives here but is a **geocoder data dependency** (state-centroid
  fallback in `geocoder.js`), not UI — don't delete it.

End to end: `ingest/inbox/` → `destila.js` (drafts) → `revisar-server.js` (human approves) →
`publica-sitrep.js` → `src/curated/sitreps.json`.

### Catalog layer (`src/ingest/`) — feeds the bot, not a web app

`src/ingest/run.js` + read-only adapters (`ayudave.js`, `sismosve.js`, `usgs.js`,
`terremotovenezuela.js`) fetch external crisis sources → `data/bundles/*.json` (resilient: a failed
source degrades to an empty bundle). `responder.py` reads `data/bundles/centros.json` to answer acopio
queries; `geocoder.js` is shared with `destila.js`. `npm run ingest` regenerates the bundles.

### Curated

- `src/curated/*.json` — human-verified data. `sitreps.json` is the publish target of the gate above.
  `panel-vital.json` (emergency contacts) and `servicios.json` are verified data with schema tests but no
  live HTTP consumer yet — they're the seed for a future control-tower/export view.

## LLM providers differ per script (don't assume one)

- `scripts/destila.js` → **Ollama local** (Qwen2.5, OpenAI-compat). Keeps PII off external services by
  default. Env: `DESTILA_BASE_URL` / `DESTILA_MODEL` / `DESTILA_API_KEY`.
- `scripts/analiza.js` → **Gemini** (OpenAI-compat endpoint). Env: `ANALIZA_*`, reuses the humanitas key.
- `ingest/destilador.py` → **Gemini native** `generateContent`, `gemini-2.5-flash-lite` (OpenAI-compat
  returns 404 here). Env: `GEMINI_API_KEY` / `ECHO_*`. **Forwarded content goes to Gemini → potential PII**,
  which is why the reply layer is gated off by default.

## Invariants — do not break

- **Human gate before anything public.** Scripts draft/analyze; only the operator publishes. No auto-publish.
- **Zero PII in the public store.** People (missing/located) go to a separate private index, never to
  `src/curated/sitreps.json`. `inbox/` and WhatsApp exports are gitignored.
- **This is a public repo.** Gitignored for that reason: `.env`, `inbox/`, `data/bundles/`, `.codegraph/`,
  `docs/WhatsApp Chat*/`, and the PII datasets (`data/missing.json`, `data/patients.json`,
  `data/puntos_ayuda_live_db.csv`). Never commit PII or secrets.
- **`data/bundles/*` are generated** (by `npm run ingest`), not committed — `responder.py` reads
  `data/bundles/centros.json`, which you must generate first.
- **Provenance + freshness per published item.** `publica-sitrep.js` rejects items without `fuenteOrigen`.

## Workflow conventions (`docs/WORKFLOW.md`)

- GitHub Issues are the single source of truth. One branch ↔ one issue (`agent/<slice>`).
- `main` is integration-only and must stay green; agents work in worktrees under `.claude/worktrees/`.
- Run `/security-review` on the diff before merging anything touching PII, secrets, or money/liability.
