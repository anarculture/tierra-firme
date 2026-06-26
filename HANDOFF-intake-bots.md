# HANDOFF — intake bots + destilación→store (26-jun-2026, tarde)

> **Work-stream:** `intake-bots` · branch `agent/intake-bots` · worktree `.claude/worktrees/intake-bots`
> (Handoffs namespaced por work-stream para no chocar entre agentes: `HANDOFF-<stream>.md`.)
>
> Para el agente que continúe **este** work-stream en `~/Code/monitorVE`. Lee también `CLAUDE.md`,
> `BUILD.md` y `CONTEXT.md`. Historia en claude-mem (project `monitorVE`).
> **Concurrencia:** hay varios agentes en main vía worktrees (`.claude/worktrees/`). Trabajá en
> tu propio worktree, no en el árbol principal, y mergeá a main por chunk (no reescribas historia).

## Dónde estamos
monitorVE vivo (S0–varios slices): shell, sísmico (réplicas + fallback USGS), mapa Leaflet/CARTO +
choropleth, adaptadores ingest (16 fuentes), PIP, sitreps/needs-board/gaps/confianza (otros agentes).
Gates verdes (`npm test` = 39), API en `:8787`.

El **diferenciador** es el bot que destila el caos real (voz/fotos/reenvíos) en datos limpios.
Nadie más convierte el caos en datos verificados y deduplicados.

## ✅ Hecho esta sesión (todo en main)
**Bots de intake** (`ingest/`, stdlib, sin deps):
- `inbox.py` — contrato único del inbox (`append`, rutas). Ambos canales escriben el mismo
  JSONL `{ts,from,kind,text,media}` → `ingest/inbox/` (gitignored, PII).
- `whatsapp_buzon.py` — webhook **Meta Cloud API** (:8788): verify-token, firma HMAC, descarga
  media 2 pasos, `ThreadingHTTPServer`. `--selftest` verde. Security-reviewed (sanitiza media_id
  anti path-traversal; avisa si falta `WA_APP_SECRET`).
- `telegram_buzon.py` — long-poll, ya existía; ahora usa el `append` compartido.
- Gate de cada uno: `python3 ingest/<bot>.py --selftest`.

**Destilación → store** (el loop `inbox → /sitrep → gate humano → store`):
- ⚠ **El store NO es Supabase.** Supabase sigue STUB (`supabase/migrations/0001` + `src/resolucion`
  tiran TODO, sin client). El store real ya cableado = **JSON curado** `src/curated/sitreps.json`
  (servido por la API, renderizado por la app). Escribí a esa capa, no dupliques.
- `scripts/publica-sitrep.js` — writer: items aprobados → `sitreps.json`. Exige `fuenteOrigen`
  (procedencia), autocompleta `verificadoEl` (frescura), dedup por `titulo`+`zona`. Gate humano =
  correrlo solo sobre lo aprobado. Test `test/publica-sitrep.test.js`. Cero PII.

**Docs:**
- `docs/BOT-whatsapp-setup.md` — handoff **solo-Meta** para el compañero (sin terminal): reunir
  credenciales, conectar webhook, probar.
- `ingest/README.md` — runbook del **dev**: correr bots + `cloudflared tunnel`.
- `docs/DESTILACION.md` — el loop completo.

## ⏳ Pendiente inmediato: ACTIVAR el bot (prioridad, bloqueado afuera)
Falta **activación**, no código. Esperando credenciales de WhatsApp del compañero
(`WA_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, número). Cuando lleguen:
- Dev corre `python3 ingest/whatsapp_buzon.py` + `cloudflared tunnel --url http://localhost:8788`,
  pasa la URL al compañero, que la pega en Meta (Parte B/C del doc). Prueba = nota de voz → `inbox/`.
- URL temporal cambia cada corrida. URL fija = named tunnel + dominio **planvenezuela.org**
  (registrado en Spaceship) — slice de deploy aparte.

## Próximo slice de código: índice de personas (PII)
Aún STUB: `src/dedup` y `src/resolucion`. El sitrep público NO lleva personas; van a un **índice
privado** (buscada→localizada, reportante aparte, localización). Honrá las congeladas:
- **Dedup sesgado a separar** (ADR 0001): confirmado (nombre+edad/zona) colapsa; posible no;
  cruce desaparecida×localización siempre manual. **No** dedup por teléfono (es del reportante).
- **Cero PII** en claro (sin cédulas); procedencia + frescura por registro.
- Toca PII → **requiere `/security-review`** antes de cerrar (como S8/S10).
- Disparador de destilación: **a demanda** por ahora; automatizar la llamada LLM después.

## Activos importados de `corve` (donante de datos, NO Fuente en vivo)
En `data/imported/corve/` (ver su `README.md`). corve es un repo de un tercero; tomamos solo
estáticos, no su arquitectura.
- `categorias.md` — ✅ taxonomía (prioridad/color/icono). Reusar para mapear necesidad/servicio en la destilación.
- `acopios-caracas-chronicle.md` — ✅ verificado (~5 filas, semilla; ampliar). Slice S4.
- `venezuela-estados.min.geojson` — ✅ 13MB→277KB. Fallback offline del mapa. Falta engancharlo.

## Contexto estratégico
Hilo completo (por qué comms/sitrep es el mayor valor en fase aguda) en
`~/Code/assistant/brainstorms/monitorVE-comunicacion-sitrep.md`. Tarjeta en
`~/Code/assistant/vault/proyectos/monitorVE.md`.
