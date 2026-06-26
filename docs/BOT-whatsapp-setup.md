# Handoff: poner a recibir el buzón de WhatsApp (monitorVE)

> Para un compañero. **Pásale este archivo entero a tu Claude Code** (dentro del repo `monitorVE`).
> Meta: el bot de WhatsApp recibe lo que la gente manda (voz/foto/texto) y lo vuelca a `ingest/inbox/`.
> Solo es **recepción** — la destilación (`/sitrep`) es otro paso.
>
> WhatsApp **no sondea** como Telegram: Meta entrega por POST a un HTTPS público, así que hace falta
> exponer el bot con un túnel. Dividido en lo que **TÚ (humano)** haces en Meta y lo que **CLAUDE**
> hace en la terminal. Orden: A → B → C.

---

## PARTE A — Humano (datos de tu app de Meta/WhatsApp)
Ten a mano (de la app que ya tienes registrada):
- `WA_TOKEN` — token permanente (System User). Para bajar la media (voz/fotos).
- `WA_APP_SECRET` — el *App Secret*. **Obligatorio**: valida la firma de Meta.
- `WA_VERIFY_TOKEN` — invéntalo (cualquier string). Lo repites en B y C; debe coincidir.
- El número de WhatsApp Business de la app.

---

## PARTE B — Claude (terminal). Pégale esto a tu Claude:

> Estoy en el repo `monitorVE`. Quiero poner a correr el buzón de WhatsApp
> (`ingest/whatsapp_buzon.py`, escucha en :8788) y exponerlo con un túnel de Cloudflare para que Meta
> le entregue los webhooks. Haz, parando si algún paso falla:
>
> 1. Verifica el bot sin red: `python3 ingest/whatsapp_buzon.py --selftest` → debe imprimir `selftest OK`.
> 2. Instala `cloudflared` (paquete oficial para mi distro).
> 3. Arranca el bot (pídeme los 3 valores; **WA_APP_SECRET es obligatorio**):
>    `WA_VERIFY_TOKEN=… WA_TOKEN=… WA_APP_SECRET=… python3 ingest/whatsapp_buzon.py`
>    (déjalo corriendo en background o tmux).
> 4. Exponlo: `cloudflared tunnel --url http://localhost:8788`
>    → copia la URL pública que imprime (`https://algo.trycloudflare.com`).
> 5. **Verifica** (gate): con esa URL y el verify token,
>    `curl 'https://algo.trycloudflare.com/?hub.mode=subscribe&hub.verify_token=EL_TOKEN&hub.challenge=ping'`
>    debe responder exactamente `ping`.

---

## PARTE C — Humano (conectar Meta)
En la app de Meta → **WhatsApp → Configuration → Webhook**:
- **Callback URL**: la URL del túnel (paso 4).
- **Verify token**: el mismo `WA_VERIFY_TOKEN`.
- **Subscribe** al campo **`messages`**.

Al guardar, Meta hace el GET de verificación (el mismo del curl) y queda suscrito.

**Prueba final:** manda una **nota de voz** al número. Confirma:
- línea nueva en `ingest/inbox/<fecha>.jsonl`,
- el `.ogg` en `ingest/inbox/media/`.

Listo: el caos entra por WhatsApp → inbox.

---

## Notas
- **`WA_APP_SECRET` siempre.** Sin él el bot corre pero no valida la firma → cualquiera con la URL
  inyecta registros falsos (el bot avisa con ⚠). No lo dejes así.
- **`inbox/` tiene PII** (teléfonos). Está gitignored: nunca al repo, nunca público.
- **URL temporal:** la de `cloudflared tunnel --url` cambia en cada corrida (hay que re-pegarla en
  Meta). Para una URL **fija** se usa un *named tunnel* sobre un dominio — paso aparte, cuando esto ya funcione.
- **Telegram** (si lo quieren también): no necesita túnel — `export TELEGRAM_BOT_TOKEN=… && python3 ingest/telegram_buzon.py`.
