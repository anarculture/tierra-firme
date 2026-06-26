# `ingest/` — buzones de intake (Telegram + WhatsApp)

Colectores que vuelcan el **caos crudo** (texto, voz, fotos, reenvíos) al **mismo**
inbox para que `/sitrep` lo destile. Ningún colab distingue el canal: ambos escriben
`inbox/<YYYY-MM-DD>.jsonl` con líneas `{ts, from, kind, text, media}` (contrato en
`inbox.py`). Media a `inbox/media/`. **`inbox/` es gitignored — contiene PII, nunca al repo.**

> Transcripción de voz: la hace `/sitrep` con `transcribe.py` (faster-whisper, `.venv`).
> Los buzones solo guardan el `.ogg`.

```
inbox.py            contrato compartido: append(rec) + rutas
telegram_buzon.py   buzón Telegram (long-poll, sin endpoint público)
whatsapp_buzon.py   buzón WhatsApp (Meta Cloud API, webhook → necesita HTTPS público)
transcribe.py       voz → texto (lo usa /sitrep)
```

Prueba sin red (gate de cada buzón):
```bash
python3 telegram_buzon.py --selftest
python3 whatsapp_buzon.py --selftest
```

---

## Telegram (rápido, sin infra)

1. Crea el bot con [@BotFather](https://t.me/BotFather) → copia el token.
2. Corre el buzón:
   ```bash
   export TELEGRAM_BOT_TOKEN=<token>
   python3 telegram_buzon.py
   ```
3. Escríbele al bot (o reenvíale algo). Verás `+ HH:MM Nombre: text …` y una línea
   nueva en `inbox/<fecha>.jsonl`.

Telegram sondea (long-poll), así que **no necesita endpoint público**.

---

## WhatsApp (Meta Cloud API)

WhatsApp **no sondea**: Meta entrega los mensajes por POST a un HTTPS público.
Corres el webhook local y lo expones con un túnel.

### 1. Variables
```bash
export WA_VERIFY_TOKEN=<inventa una cadena; la repites en el paso 4>
export WA_TOKEN=<token permanente de la app / system user>   # para bajar media
export WA_APP_SECRET=<App Secret de la app de Meta>          # valida la firma (recomendado)
```
Sin `WA_TOKEN` el buzón corre igual pero no baja media (solo texto/captions).

### 2. Corre el webhook
```bash
python3 whatsapp_buzon.py        # escucha en :8788
```

### 3. Expón con cloudflared
```bash
cloudflared tunnel --url http://localhost:8788
```
Copia la URL pública que imprime (`https://algo.trycloudflare.com`).

### 4. Configura el webhook en Meta
En la app de Meta → WhatsApp → Configuration → Webhook:
- **Callback URL**: la URL de cloudflared (el path no importa; el server responde en cualquiera).
- **Verify token**: el mismo `WA_VERIFY_TOKEN` del paso 1.
- Suscríbete al campo **`messages`**.

Meta hace un GET de verificación; si el token coincide, el server devuelve el
`hub.challenge` y queda suscrito.

### 5. Prueba e2e
Manda una **nota de voz** al número de WhatsApp Business. Deberías ver
`+ HH:MM Nombre (telefono): voice` en consola y:
- la línea en `inbox/<fecha>.jsonl`,
- el `.ogg` en `inbox/media/`.

> **PII**: WhatsApp expone el teléfono del remitente (Telegram no). Va al `from` del
> record, dentro de `inbox/` gitignored. Este slice requiere `/security-review` antes de cerrar.

> **Túnel temporal**: la URL de `cloudflared tunnel --url` cambia en cada corrida.
> Para algo estable, un named tunnel o deploy — cuando el volumen lo pida (hoy: a demanda).
