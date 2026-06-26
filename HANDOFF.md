# HANDOFF — bot de intake: destilación → store (26-jun-2026)

> Para el agente que abra esta sesión en `~/Code/monitorVE`. Lee también `CLAUDE.md`,
> `BUILD.md` y `CONTEXT.md`. Historia en claude-mem (project `monitorVE`).

## Dónde estamos
monitorVE ya está vivo (S0–varios slices): shell, sísmico (réplicas + fallback USGS),
mapa Leaflet/CARTO + choropleth, adaptadores ingest (ayudave/acopio/terremoto, 16 fuentes),
PIP. Gates verdes, API en `:8787`.

Hoy se agregó una **fuente de intake nueva, fuera de los 14 slices**: el **bot que destila
el caos real** (voicenotes, screenshots, reenvíos de WhatsApp) en registros limpios. Es el
diferenciador: las plataformas existentes (AyudaVE, Venezuela te busca, Desaparecidos…) son
formularios sin API, sin verificación y sin dedup. Nadie convierte el caos en datos limpios.

## Ya construido (en `ingest/`)
- `telegram_buzon.py` — colector Telegram (stdlib, long-poll). Vuelca texto/voz/foto a
  `ingest/inbox/` (gitignored, PII). Falta activarlo: crear bot con @BotFather + export
  `TELEGRAM_BOT_TOKEN`.
- `transcribe.py` — transcribe voz con faster-whisper (`.venv`, modelo `small`, es-VE). Probado.
- Cerebro destilador = skill global `/sitrep` (caos → sitrep + registros de personas).

## Próximo paso: destilación → store
Objetivo: el dump del inbox se destila en **registros estructurados, deduplicados y atribuidos**,
escritos al **store propio de monitorVE** (la capa propia ya usa Supabase para escrituras).

**ANTES de codear: revisa el esquema existente** (`supabase/` + `src/`) y NO dupliques. El bot
es una fuente de ingest más; engánchalo a la ruta de escritura de la capa propia que ya exista.

Honra las decisiones congeladas (ver BUILD.md / ADRs):
- Modelo: persona (`desaparecida→localizada`), reportante (entidad aparte, **no** dedup por
  teléfono), localización (visto/hospitalizado/morgue/refugio/rescatado), necesidad, servicio.
- **Dedup sesgado a separación**: match confirmado (nombre+edad/zona) colapsa; posible no;
  cruce desaparecida×localización siempre manual.
- **Cero PII** (sin cédulas en claro); procedencia + frescura obligatorias en cada registro.
- **Gate humano**: el bot produce BORRADOR con ✓/⏳; un humano verifica antes de publicar.
  Las personas tocan PII → este slice requiere `/security-review` antes de cerrar (como S8/S10).

## Decisión abierta
Disparador de la destilación: por ahora **a demanda** (correr `/sitrep` sobre el inbox y
escribir al store). Automatizar la llamada LLM viene después, cuando el volumen lo pida.

## Activos importados de `corve` (donante de datos, NO Fuente en vivo)
En `data/imported/corve/` (ver su `README.md`). corve es un repo vibecodeado de un tercero;
tomamos solo estáticos, no su arquitectura ni conexión a su sistema.
- `categorias.md` — ✅ taxonomía de categorías (prioridad/color/icono). Reusar para mapear
  necesidad/servicio en la destilación del bot. Listo.
- `acopios-caracas-chronicle.md` — ✅ verificado (Caracas Chronicle). ~5 filas, semilla; ampliar. Slice S4.
- `venezuela-estados.min.geojson` — ✅ simplificado 13MB→277KB. Fallback offline del mapa
  (evita geoBoundaries inestable). Falta engancharlo al mapa.

## Contexto estratégico
Hilo completo (por qué comms/sitrep es el mayor valor en fase aguda, los 4 sombreros, etc.)
en `~/Code/assistant/brainstorms/monitorVE-comunicacion-sitrep.md`. Tarjeta de proyecto en
`~/Code/assistant/vault/proyectos/monitorVE.md`.
