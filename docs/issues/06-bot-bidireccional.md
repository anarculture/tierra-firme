# 06 — Bot bidireccional (webhook de 2 vías) — enabler

**Tipo:** AFK · **Track:** Chat

## What to build

El habilitador de todo el track de chat: WhatsApp de **dos vías** — el bot no solo recibe, también
**responde** en el mismo hilo. **Entregado por el merge de Zavu** (el repo pivoteó de Meta directo a
Zavu, API multicanal): `ingest/zavu_buzon.py` recibe (webhook + firma HMAC anti-replay) y tras el
intake llama a `maybe_reply(...)`, que responde por `send_zavu()` en `ingest/reply.py`.

- Recibir (`zavu_buzon.py`) → destilar → **responder al remitente** por Zavu (`send_zavu`, POST
  `/v1/messages`, fallback SMS automático). El SDK `@zavudev` NO se usa — `urllib` stdlib (regla sin-deps).
- Base para #07 (clasificación + desambiguación en chat) y #08 (confirmación inline). Sin esto, el
  intake es descarga manual del chat y las confirmaciones van solo por panel.
- Restricción dura intacta: firma HMAC (`ZAVU_WEBHOOK_SECRET`) salvo `--dev`; el saliente se gatea por
  `REPLY_ENABLED` (default OFF — el bot calla hasta que confíes en él); server-light stdlib.

Esto vuelve reales las features C (dedup anti-ruido) y D (señal de resolución) de `TIERRA-FIRME.md`.

## Acceptance criteria

- [x] El bot envía un mensaje de vuelta al remitente por WhatsApp (Zavu) tras recibir un dump (`maybe_reply→send_zavu`).
- [x] Verificación de firma HMAC intacta (selftest sin red sigue verde — es parte del gate CI).
- [x] El path de respuesta se puede apagar por env (`REPLY_ENABLED`, default OFF).
- [x] `python3 ingest/zavu_buzon.py --selftest` (firma HMAC + intake) y `ingest/reply.py --selftest` (respuesta, mock) verdes.

## Blocked by

None - can start immediately (puede ir en paralelo al track Libro). **Entregado por el merge de Zavu.**
