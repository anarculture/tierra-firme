# Plan: Bots de intake multicanal (Telegram + WhatsApp)

**Risk level**: Low-Medium (maneja PII: WhatsApp expone teléfono del remitente; API externa)

## Summary
Agrega un buzón de WhatsApp (Meta Cloud API) en paridad con el de Telegram que ya existe, y
activa Telegram. Ambos vuelcan al **mismo** inbox JSONL (`{ts,from,kind,text,media}`) para que
`/sitrep` los destile sin saber el canal. WhatsApp es webhook (no long-poll) → corre un server
HTTP local expuesto con `cloudflared`. **No** incluye destilación→store (slice aparte), ni que el
bot responda a usuarios, ni dedup.

## Architecture Decisions
1. **Proveedor WhatsApp**: Meta Cloud API. Razón: sin opt-in por usuario (cualquiera escribe directo
   — clave para intake público), tier gratis, número de prueba instantáneo. Twilio exige `join <code>`
   por usuario = inviable para buzón público. El parser del payload es **una función aislada**
   (`parse_meta`) → si cambian de proveedor, se reescribe solo eso.
2. **Hosting webhook**: `cloudflared tunnel` en dev (decidido). Cero infra, URL pública temporal.
   Deploy cuando el volumen lo pida (alineado con "a demanda" del HANDOFF).
3. **Lenguaje**: Python stdlib (`http.server`), igual que `telegram_buzon.py` + `transcribe.py`.
   Reusa el contrato del inbox directo. Sin deps nuevas.
4. **Contrato del inbox = fuente única**: extraer `append()` + rutas a `ingest/inbox.py` para que
   ambos bots escriban formato idéntico (evita drift silencioso que rompería `/sitrep`). Telegram
   recibe un edit mínimo para importarlo; su comportamiento no cambia (selftest lo prueba).
5. **PII**: WhatsApp guarda el teléfono en `from` (Telegram no). Igual que hoy, `inbox/` es gitignored.
   `/security-review` obligatorio antes de cerrar el slice (toca PII), como S8/S10.
6. **Puerto**: webhook en `:8788` (el API Node usa `:8787`). Sin colisión.

## Implementation Steps

### Step 1: Contrato de inbox compartido
**Files**: `ingest/inbox.py` (nuevo), `ingest/telegram_buzon.py` (edit mínimo)
**What to build**: `ingest/inbox.py` con `INBOX`/`MEDIA`, `append(rec)`, `media_relpath(name)`. Mover
la lógica de `append()` de telegram a este módulo; telegram lo importa. Sin cambiar el formato ni el
flujo de telegram. ~20 líneas. `append` permanece idempotente por append (no dedup acá).
**Test gate**: `cd ingest && python3 telegram_buzon.py --selftest` imprime `selftest OK` (sigue verde).

### Step 2: Buzón WhatsApp (Meta Cloud API)
**Files**: `ingest/whatsapp_buzon.py` (nuevo)
**What to build**: server `http.server` en `:8788`.
- **GET `/webhook`**: handshake de Meta — si `hub.verify_token == env WA_VERIFY_TOKEN`, responde
  `hub.challenge` (200). Si no, 403.
- **POST `/webhook`**: lee body crudo; si hay `WA_APP_SECRET`, valida `X-Hub-Signature-256` (HMAC-SHA256);
  parsea `entry[].changes[].value.messages[]` con `parse_meta()` → record `{ts,from,kind,text,media}`.
  `from` = teléfono (PII, va al inbox gitignored). Responde 200 siempre (Meta reintenta si no).
- **Media**: `media_id` → GET `graph.facebook.com/v21.0/<id>` con `Bearer WA_TOKEN` → `url` → descarga
  bytes (mismo bearer) → `inbox/media/<id>.<ext>`. Mapea `audio/voice→ogg, image→jpg, video→mp4,
  document→bin`. Sin token, omite descarga (igual que telegram).
- **Escribe** vía `inbox.append()` (Step 1). Sin transcripción acá (`/sitrep` transcribe el .ogg).
- **`--selftest`**: payload Meta falso (texto + un audio) → `parse_meta()` da el record correcto,
  `append()` escribe la línea. Sin red. ~80–100 líneas (paridad con telegram).
**Test gate**: `cd ingest && python3 whatsapp_buzon.py --selftest` imprime `selftest OK`.

### Step 3: Runbook de activación + prueba e2e
**Files**: `ingest/README.md` (nuevo)
**What to build**: pasos verificables para los DOS canales:
- Telegram: crear bot @BotFather → `export TELEGRAM_BOT_TOKEN=…` → `python3 telegram_buzon.py` →
  mandar un mensaje → ver `+ … : text …` y la línea en `inbox/<fecha>.jsonl`.
- WhatsApp: `export WA_VERIFY_TOKEN/WA_TOKEN/WA_APP_SECRET` → `python3 whatsapp_buzon.py` →
  `cloudflared tunnel --url http://localhost:8788` → pegar URL en el webhook de la app Meta con el
  verify-token → mandar una nota de voz → ver el record + el .ogg en `inbox/media/`.
**Test gate (manual, lado usuario)**: una nota de voz de WhatsApp y un mensaje de Telegram aterrizan
como líneas en el mismo `inbox/<fecha>.jsonl` con el mismo esquema. (Documentado; lo corres tú con
los tokens reales.)

## Success Criteria & Out of Scope
**Éxito (verificable)**:
- `telegram_buzon.py --selftest` y `whatsapp_buzon.py --selftest` verdes.
- Ambos bots producen líneas JSONL idénticas en esquema `{ts,from,kind,text,media}` en `ingest/inbox/`.
- Runbook e2e documentado para ambos canales.
- Sin deps nuevas (stdlib); `inbox/` sigue gitignored.
- `/security-review` corrido antes de cerrar (PII: teléfono WhatsApp).

**Fuera de alcance** (slices aparte):
- Destilación inbox→store (el "próximo paso" del HANDOFF; requiere store hoy STUB + security-review).
- Que el bot **responda** a usuarios (plantillas, ventana 24h) — esto es solo recepción.
- Dedup / clústeres / resolución.
- Deploy a prod del webhook (hoy: túnel dev).
- Transcripción dentro del bot (la hace `/sitrep` vía `transcribe.py`).
