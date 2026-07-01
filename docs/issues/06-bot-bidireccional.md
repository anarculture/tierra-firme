# 06 — Bot bidireccional (webhook de 2 vías) — enabler

**Tipo:** AFK · **Track:** Chat

## What to build

El habilitador de todo el track de chat: WhatsApp de **dos vías** — el bot no solo recibe, también
**responde** en el mismo hilo. Hoy `ingest/whatsapp_buzon.py` recibe (webhook + firma HMAC) pero el
responder está apagado (`WA_RESPONDER` gate, ver [[feature-a-acopiove-live]]). Esta issue completa
el camino de salida.

- Recibir (ya existe) → destilar → **responder al remitente** por la API de WhatsApp (Meta Graph).
- Base para #07 (clasificación + desambiguación en chat) y #08 (confirmación inline). Sin esto, el
  intake es descarga manual del chat y las confirmaciones van solo por panel.
- Mantener la restricción dura del repo: firma HMAC (`WA_APP_SECRET`) salvo `--dev`; sin deps
  externas más allá de lo ya cableado; corre server-light.

Esto vuelve reales las features C (dedup anti-ruido) y D (señal de resolución) de `TIERRA-FIRME.md`.

## Acceptance criteria

- [ ] El bot envía un mensaje de vuelta al remitente por WhatsApp tras recibir un dump.
- [ ] Verificación de firma HMAC intacta (selftest sin red sigue verde — es parte del gate CI).
- [ ] El path de respuesta se puede apagar por env (gate) para no responder en pruebas.
- [ ] `python3 ingest/whatsapp_buzon.py --selftest` cubre el path de firma y el de respuesta (mock).

## Blocked by

None - can start immediately (puede ir en paralelo al track Libro).
