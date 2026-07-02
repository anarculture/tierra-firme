# Handoff — Tierra Firme: qué falta para el bot de dump en producción

> Fecha: 2026-07-01 · **actualizado 2026-07-02**. Junta el estado del conector
> VLM→needs (DONE) con el intake Zavu de WhatsApp y **especifica lo que falta para
> producción**. El código está listo; el bloqueo es **infra + cuenta**, no programar.
> SSOT de alcance: `TIERRA-FIRME.md` + `docs/adr/` — canal único **WhatsApp vía
> Zavu**, audio por **Gemini** (Telegram y whisper = legacy fuera del PRD).

**Bot de dump** = recibir el caos crudo (texto/voz/foto/reenvío) al inbox compartido.
Producir salida verificada (destila→revisar→publica) es una etapa aparte, ya manual.

---

## Estado actual — qué YA está hecho

### Intake Zavu (branch `zavu` · **mergeado a `main` 2026-07-02**, worktree limpiado)
- `d682e9d` — WhatsApp por **Zavu** (API multicanal), reemplaza Meta directo.
  - `ingest/zavu_buzon.py` — webhook `:8789`, firma `X-Zavu-Signature` (HMAC de
    `"{t}.{body}"`, anti-replay >5min), resuelve `mediaId→url` y baja media. Escribe
    el mismo contrato de inbox (`{ts,from,kind,text,media}`). `--selftest` verde.
  - `ingest/reply.py` — `send_zavu()` (`POST /v1/messages`, fallback SMS auto) +
    rama `channel=="zavu"`. Gated por `REPLY_ENABLED` (default OFF).
  - Borrados: `whatsapp_buzon.py`, `docs/BOT-whatsapp-setup.md`. API cruda con
    `urllib` — **no** el SDK `@zavudev` (regla sin-deps).
- `6ce1de8` — quita tareas/handoff stale del setup Meta borrado.
- Gate: `zavu_buzon` + `reply` selftests + `node --test` (100 en `main`) verde.

### Telegram (legacy, FUERA del PRD)
- `ingest/telegram_buzon.py` existe pero **no se deploya ni se extiende** — canal
  único = WhatsApp vía Zavu. Purga pendiente de decisión.

### Conector VLM→needs (mergeado a `main` · DONE + desplegado)
- Los ítems de fotos extraídos por el VLM llegan a `site/needs.json` y al sitio.
  Verificado en vivo 2026-07-01 (17 necesidades, Catia 46 ítems).
- `scripts/vlm-import.js` + test, `scripts/analiza.js` (aviso media sin `enriched`),
  `npm run enriquece`. Detalle en `docs/issues/08-vlm-import-batch.md` y `01-vlm-analiza.md`.

### Deploy sitio (semi-automatizado, gate humano)
- `npm run deploy` (`scripts/deploy.js`, feat 11): genera informe+lista → PARA en
  revisión humana → `--deploy` force-pushea a `gh-pages` (nunca a main).
  Live: https://anarculture.github.io/tierra-firme/needs.json

### Pipeline de salida (manual, human gate — intencional)
```
LIVE:   inbox → npm run enriquece -- <fecha> (foto/voz→texto) → node scripts/analiza.js <fecha>
              → node scripts/publica.js → site/needs.json → push gh-pages
BATCH:  fotos → npm run extract-media → resultados-vlm.json → node scripts/vlm-import.js <fecha>
              → merge draft → publica → push gh-pages
```

---

## LO QUE FALTA PARA PRODUCCIÓN

> **Verificado en vivo 2026-07-01** con la API real (key del team `htmk`). Producto
> = **WhatsApp only** como inbox (SMS descartado por el usuario). Estado de la cuenta:
> - Cuenta Zavu viva, plan **Hobby**, pay-as-you-go `$0/$10` (falta cargar créditos).
> - Sender **"Tierra Firme"** con WhatsApp/WABA conectado, número `+15559131919`
>   (provisto por Zavu), `phoneNumberId` seteado.
> - **Webhook configurado** en ese sender (`message.inbound`) — se probó de punta a
>   punta con un `message.inbound` **firmado** (X-Zavu-Signature válido) → escribió la
>   línea en `inbox/`. **El código está probado.**
> - Sender "Default" `+13213951815` = **SMS/voz, NO WhatsApp** — no se usa.

### A. Bloqueo real: KYC + créditos (no código, lo resuelve Zavu/Meta)
- [ ] **A1 · KYC de WhatsApp EN PROCESO** — el dashboard muestra *"KYC Verification In
  Progress — you will be notified once complete"*. Hasta que Zavu/Meta lo completen, el
  número WhatsApp **no recibe** mensajes reales (por eso el WhatsApp de prueba no entró).
  **Ninguna API ni el MCP lo aceleran.** Esperar el aviso de Zavu.
- [ ] **A2 · Créditos** — plan Hobby con $0 cargados; "Agregar créditos" en el dashboard.
- [ ] **A3 · URL pública estable** — el webhook hoy apunta a un **ngrok efímero** (muere
  al cerrar la terminal). Para prod: named tunnel + dominio (planvenezuela.org, en
  Spaceship) o VPS, y re-apuntar el webhook del sender "Tierra Firme" a esa URL con
  `message.inbound` (1 llamada `PATCH /v1/senders/{id}`, o el dashboard).

> **Cuando el KYC salga:** basta correr el buzón con el `ZAVU_WEBHOOK_SECRET` del sender
> "Tierra Firme" apuntado a la URL estable → escribirle al número WhatsApp cae al `inbox/`
> **sin tocar código** (ya demostrado con la simulación firmada).

### B. Correr 24/7 confiable
- [x] **B1 · Host always-on + supervisión** — `deploy/zavu-buzon.service` (systemd,
  `Restart=on-failure`, `EnvironmentFile`) escrito 2026-07-02. Falta solo instalarlo
  en el host (paso a paso en `docs/DEPLOY.md`).
- [x] **B2 · Secrets** — `.env.example` escrito 2026-07-02 (compatible systemd
  `EnvironmentFile`). Vars: `ZAVU_WEBHOOK_SECRET`, `ZAVU_API_KEY`, `VLM_API_KEY`,
  `REVISAR_TOKEN`, `REPLY_ENABLED`. Falta llenarlo en el host.
- [ ] **B3 · Transcripción** — `transcribe.py` default **Gemini** (`VLM_API_KEY`) —
  única vía por PRD. Ojo: `enriquece` (media→texto) es paso **manual**, no está en
  el loop de intake.
- [ ] **B4 · Dedup de reintentos** — Zavu reintenta el webhook → líneas duplicadas en
  inbox (hay `ponytail:` note en `zavu_buzon.py`). Hoy se limpia downstream en
  `analiza`. OK para MVP; confirmar que no ensucia.
- [ ] **B5 · Monitoreo** — nada avisa si el webhook muere. Falta healthcheck/log básico.

### C. PII / seguridad (no negociable)
- [ ] **C1 · `inbox/` guarda teléfonos en disco** → host privado, acceso restringido.
  El slice PII exige `/security-review` antes de cerrar.
- [ ] **C2 · Panel `revisar` gated con `REVISAR_TOKEN`** (ya existe) — setearlo antes
  de tunelizar.

### D. Producir salida (etapa aparte, ya manual)
- [ ] **D1 · Loop `destila → revisar → publica`** lo corre el operador a mano. Human
  gate = intencional (nada público sin verificación). Para un dump bot no hace falta.
- [ ] **D2 · Saliente `reply.py` OFF** (`REPLY_ENABLED`). Si se quiere acuse de recibo:
  prender + respetar la **ventana 24h** de WhatsApp (fuera de eso hace falta plantilla
  aprobada por Meta).

---

## Ruta mínima a prod (dump)
1. A1: esperar KYC de WhatsApp (Zavu/Meta) — bloqueo externo.
2. A2: cargar créditos en la cuenta Zavu.
3. B1: host chico (VPS) con systemd → `zavu_buzon` (seguir `docs/DEPLOY.md`).
4. A3: named cloudflared tunnel con dominio fijo → re-apuntar webhook Zavu.
5. B2: llenar `.env` en el host.
6. C1: `/security-review` del path PII.

## Lo cerrable por código — CERRADO 2026-07-02
- [x] `deploy/zavu-buzon.service` (`Restart=on-failure`, `EnvironmentFile`).
- [x] `.env.example` con todas las vars.
- [x] `docs/DEPLOY.md` — host + named tunnel + webhook + verificación E2E.
> Lo que queda es abrir cuentas, esperar KYC y levantar el host.

---

## Pendientes heredados del conector VLM (siguen abiertos)
- ~~PR `agent/conector-vlm` → `main`. Idem `zavu` → `main`.~~ **Ambos mergeados** (2026-07-01/02).
- **Comando único** `npm run pipeline -- <fecha>` que encadene enriquece→analiza→publica.
- **#02/#03 estado durable (problema de fondo):** `analiza` es one-shot sin memoria;
  re-correrlo reintroduce placeholders y pisa reconciliaciones manuales. Requiere `id`
  estable por necesidad + overlay de `estado` que `publica` mergee. Drafts en
  `docs/issues/02-modelo-estado-id.md` y `03-estado-end-to-end.md`. Memoria
  `[[bot-gap-reconciliacion-temporal]]`.

## Trampas conocidas (no barrer)
- `data/analisis-2026-06-29.json` y `resultados-vlm.json` son **gitignored/untracked**
  — viven solo en el checkout de `main`. Un worktree no los tiene.
- Filtro VLM: solo `relevant:true` + `kind=NECESIDAD` (descarta OFERTA y comprobantes
  con Bs/USD = PII). No aflojar.
- Pérez Carreño no auto-mergea (HMPC vs "Hospital Pérez Carreño") — 2 necesidades hasta
  fuzzy-match (#02). El operador las une a mano.
- `git status` del repo tiene ruido ajeno (rename `CONTEXT.md`, adrs, CSVs) — no es de
  este trabajo.

## Verificación (gate)
- Intake: `python3 ingest/zavu_buzon.py --selftest` + `reply.py --selftest` → verde.
- `node --test` → verde (100 en `main`, 2026-07-02).
- E2E dump: levantar buzón → túnel → webhook Zavu → mandar WhatsApp → línea en
  `ingest/inbox/<fecha>.jsonl` + `.ogg` en `inbox/media/`.
