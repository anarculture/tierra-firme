# `ingest/` — buzón de intake (WhatsApp vía Zavu)

Colector que vuelca el **caos crudo** (texto, voz, fotos, reenvíos) al inbox para
que `/sitrep` lo destile. Escribe `inbox/<YYYY-MM-DD>.jsonl` con líneas
`{ts, from, kind, text, media}` (contrato en `inbox.py`). Media a `inbox/media/`.
**`inbox/` es gitignored — contiene PII, nunca al repo.**

> Transcripción de voz: `transcribe.py` vía **Gemini** (única vía por PRD).
> El buzón solo guarda el `.ogg`.

```
inbox.py            contrato del inbox: append(rec) + rutas
zavu_buzon.py       buzón WhatsApp vía Zavu (webhook → necesita HTTPS público)
reply.py            saliente: responde si REPLY_ENABLED (default off)
transcribe.py       voz → texto vía Gemini (lo usan /sitrep y enriquece)
```

Prueba sin red (gate del buzón):
```bash
python3 zavu_buzon.py --selftest
python3 reply.py --selftest
```

---

## WhatsApp (vía Zavu)

WhatsApp **no sondea**: Zavu entrega los mensajes entrantes por POST a un HTTPS
público (evento `message.inbound`). Corres el webhook local y lo expones con un
túnel. Zavu habla con Meta por debajo, pero tú solo integras una API — y da
fallback SMS automático en el saliente.

### 1. Variables
```bash
export ZAVU_WEBHOOK_SECRET=whsec_...   # firma X-Zavu-Signature (OBLIGATORIO salvo --dev)
export ZAVU_API_KEY=zv_...             # baja media (resuelve mediaId→url) y responde
```
Sin `ZAVU_API_KEY` el buzón corre igual pero no baja media (solo texto/captions).
El secret sale del sender: dashboard.zavu.dev → Sender → Webhook.

### 2. Corre el webhook
```bash
python3 zavu_buzon.py        # escucha en :8789
```

### 3. Expón con cloudflared
```bash
cloudflared tunnel --url http://localhost:8789
```
Copia la URL pública que imprime (`https://algo.trycloudflare.com`).

### 4. Configura el webhook en Zavu
En dashboard.zavu.dev → Sender → Webhook (o al crear el sender):
- **URL**: la de cloudflared (el path no importa; el server responde en cualquiera).
- **Events**: `message.inbound` (basta para el intake).

Zavu firma cada request con `X-Zavu-Signature`; el buzón la valida con
`ZAVU_WEBHOOK_SECRET` y rechaza firmas de más de 5 min (anti-replay).

### 5. Prueba e2e
Manda una **nota de voz** al número. Deberías ver
`+ HH:MM Nombre (telefono): voice` en consola y:
- la línea en `inbox/<fecha>.jsonl`,
- el `.ogg` en `inbox/media/`.

### Saliente
`reply.py` responde por Zavu (`send_zavu` → `POST /v1/messages`) solo si
`REPLY_ENABLED=1`. Ojo la **ventana 24h** de WhatsApp: mensaje libre saliente solo
dentro de las 24h del último inbound; fuera de eso hace falta plantilla aprobada.

> **PII**: WhatsApp expone el teléfono del remitente. Va al `from` del
> record, dentro de `inbox/` gitignored. Este slice requiere `/security-review` antes de cerrar.

> **Túnel temporal**: la URL de `cloudflared tunnel --url` cambia en cada corrida.
> Para algo estable, named tunnel + systemd: ver `docs/DEPLOY.md`.
