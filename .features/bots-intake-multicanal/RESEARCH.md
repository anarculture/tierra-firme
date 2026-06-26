# Research: Bots de intake multicanal (Telegram + WhatsApp)

**Date**: 2026-06-26
**Requested**: Tener buzón de intake en Telegram Y WhatsApp que vuelque caos (voz/foto/reenvíos) al inbox para que `/sitrep` lo destile. WhatsApp será el de mayor uso; el usuario ya tiene bots de WhatsApp registrados (paga OK).
**Status**: PENDING DECISION

## Qué existe hoy
- `ingest/telegram_buzon.py` — colector Telegram completo (stdlib, long-poll). Escribe inbox JSONL. **No activado** (falta `TELEGRAM_BOT_TOKEN` de @BotFather). Tiene `--selftest`.
- `ingest/transcribe.py` — voz→texto, faster-whisper, es-VE. Probado. `.venv` solo tiene faster_whisper.
- **Formato inbox (contrato, ya fijo)**: JSONL `inbox/<YYYY-MM-DD>.jsonl`, una línea = `{ts, from, kind, text, media}`; media a `inbox/media/<id>.<ext>`. `inbox/` es gitignored (PII).
- Cerebro destilador = skill global `/sitrep`. Agnóstico de canal — consume el inbox.
- `inbox/` es la frontera: cualquier colector que escriba ese formato funciona sin tocar `/sitrep`.

## Diferencia arquitectónica clave (el riesgo central)
Telegram long-poll (`getUpdates`) **no necesita endpoint público** — por eso corre local.
**WhatsApp no tiene long-poll.** Cloud API (Meta) y los BSP (Twilio/360dialog) **solo entregan por webhook**: POST entrante a un HTTPS público con verify-token (y firma HMAC en Meta). Implicaciones:
- Hace falta una URL pública. Dev: túnel (`cloudflared`/`ngrok`). Prod: server desplegado.
- El colector WhatsApp es un **servidor HTTP que recibe**, no un cliente que sondea. Forma distinta a `telegram_buzon.py`, mismo destino (inbox).
- Descarga de media: Meta entrega `media_id` → GET autenticado a graph.facebook.com con bearer token. Twilio entrega URL directa con basic-auth.

## Qué hay que construir
- **Nuevo**: `ingest/whatsapp_buzon.py` — webhook receiver (stdlib `http.server`), normaliza payload del proveedor → mismo record `{ts,from,kind,text,media}` → `append()` al inbox. GET verify + POST recibe.
- **Reusar**: la función `record()`/`append()` de `telegram_buzon.py` define el contrato; extraer a un módulo común o duplicar el `append` (es trivial). Sesgo ponytail: duplicar `append` (5 líneas) antes que crear framework.
- **Activar**: Telegram — crear bot @BotFather, export token, `python3 telegram_buzon.py`, mandar un mensaje de prueba. Sin código.
- **Posible**: `cloudflared`/`ngrok` para exponer el webhook en dev.

## Riesgos
| Riesgo | Prob | Impacto | Notas |
|---|---|---|---|
| Endpoint público requerido (WhatsApp) | Alta | Medio | Túnel en dev; decisión de hosting en prod. Sin esto WhatsApp no recibe. |
| Forma del payload depende del proveedor | Alta | Alto | Meta Cloud API ≠ Twilio ≠ 360dialog. Codear el parser equivocado = retrabajo. **Bloquea el plan.** |
| Sesión 24h / plantillas (WhatsApp) | Media | Bajo | Solo afecta si el bot **responde**. Como buzón (solo recibe) no aplica. |
| PII en inbox | Alta | Alto | Ya mitigado: `inbox/` gitignored. WhatsApp **sí** expone teléfono del remitente (Telegram no) → más PII. `/security-review` antes de cerrar. |
| Verificación de firma/verify-token | Media | Medio | Sin validar, cualquiera postea basura al webhook. Hay que validar verify-token (y HMAC en Meta). |

## Puntos de decisión arquitectónica
1. **Proveedor WhatsApp** (BLOQUEANTE): Meta Cloud API directo · Twilio · 360dialog · otro. Define payload, descarga de media, auth. → **Necesito saber cuál de tus bots registrados.**
2. **Hosting del webhook**: túnel local (`cloudflared`, dev/MVP) vs server desplegado (prod). Recomiendo túnel ahora, deploy cuando el volumen lo pida (alineado con "a demanda" del HANDOFF).
3. **Lenguaje del colector WhatsApp**: Python (igual que `telegram_buzon.py` + `transcribe.py`, mismo inbox) vs Node (igual que la app). Recomiendo **Python** — consistencia con los colectores y reuso directo del contrato de record.
4. **Alcance**: ¿este feature = solo colectores (buzón)? La destilación inbox→store es el "próximo paso" del HANDOFF, gated por `/security-review`, y depende del store (hoy STUB). Recomiendo **colectores ahora, destilación→store después** (slice aparte).

## Estimación
- WhatsApp buzón (un proveedor, Python, stdlib): **~½ día** una vez fijado el proveedor (paridad con `telegram_buzon.py`).
- Activación Telegram + prueba e2e: **~30 min** (manual, tu lado: @BotFather).
- Túnel dev: **~15 min**.
- Destilación→store: **fuera de alcance** (slice S10-adyacente, requiere store + security-review).
- Confianza: **media** — alta en estructura, bloqueada por la decisión #1.

## Recommendation
**NEEDS CLARIFICATION** — la estructura es clara y de bajo riesgo, pero el proveedor de WhatsApp (decisión #1) determina el parser del webhook y no puedo planear sin él. Resueltas #1–#4, esto es GO directo.

**Decision**: [ ] GO  [ ] NO-GO  [x] NEEDS CLARIFICATION
