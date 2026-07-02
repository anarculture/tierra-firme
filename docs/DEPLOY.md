# Deploy — bot de dump en producción

Levantar el buzón WhatsApp (vía Zavu — único canal, ver `TIERRA-FIRME.md`) 24/7 en
un host propio, con URL pública estable para el webhook. Audio → texto por Gemini
(`VLM_API_KEY`), sin whisper local. El pipeline de salida (destila→revisar→publica)
sigue siendo manual del operador — intencional, no se deploya.

Contexto y pendientes: `HANDOFF-produccion.md`.

## 1. Host

VPS chico (1 GB sobra: stdlib puro, sin deps). Debian/Ubuntu.

```bash
sudo git clone https://github.com/anarculture/tierra-firme /opt/tierra-firme
cd /opt/tierra-firme
cp .env.example .env && $EDITOR .env    # llenar ZAVU_*, VLM_API_KEY, REVISAR_TOKEN
chmod 600 .env
mkdir -p ingest/inbox && chmod 700 ingest/inbox    # PII: teléfonos en disco
```

## 2. Buzón bajo systemd

```bash
sudo cp deploy/zavu-buzon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zavu-buzon
systemctl status zavu-buzon
journalctl -u zavu-buzon -f    # logs / monitoreo (no hay healthcheck aparte)
```

Gate antes de exponer: `python3 ingest/zavu_buzon.py --selftest` verde en el host.

## 3. Túnel con dominio fijo (cloudflared named tunnel)

El webhook de Zavu necesita URL estable — el `cloudflared tunnel --url` efímero
muere con la terminal. Named tunnel con el dominio (planvenezuela.org, en Spaceship,
DNS delegado a Cloudflare):

```bash
cloudflared tunnel login
cloudflared tunnel create tierra-firme
cloudflared tunnel route dns tierra-firme hook.planvenezuela.org
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: tierra-firme
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: hook.planvenezuela.org
    service: http://localhost:8789
  - service: http_status:404
```

```bash
sudo cloudflared service install    # genera su propia unit systemd
sudo systemctl enable --now cloudflared
```

## 4. Apuntar el webhook de Zavu

Dashboard → sender "Tierra Firme" → webhook `https://hook.planvenezuela.org` con
evento `message.inbound`. O por API:

```bash
curl -X PATCH https://api.zavu.dev/v1/senders/<SENDER_ID> \
  -H "Authorization: Bearer $ZAVU_API_KEY" -H "Content-Type: application/json" \
  -d '{"webhook":{"url":"https://hook.planvenezuela.org","events":["message.inbound"]}}'
```

## 5. Verificar E2E

1. `curl -s -o /dev/null -w '%{http_code}' https://hook.planvenezuela.org` → responde (no 502).
2. Mandar un WhatsApp al número del sender (requiere KYC completo).
3. En el host: línea nueva en `ingest/inbox/<fecha>.jsonl`; si hay media, archivo en `ingest/inbox/media/`.
4. Firma inválida → 401 en `journalctl -u zavu-buzon` (rechazo funciona).

## Notas

- **PII**: el inbox guarda teléfonos → host privado, acceso restringido, nada de
  syncearlo fuera. `/security-review` del path antes de cerrar el slice (C1 del handoff).
- **Reintentos Zavu** → líneas duplicadas en inbox; se dedupea downstream en `analiza` (OK MVP).
- **Saliente OFF** (`REPLY_ENABLED=0`). Para acuse de recibo: prender + ventana 24h de WhatsApp.
- Actualizar código: `git -C /opt/tierra-firme pull && sudo systemctl restart zavu-buzon`.
