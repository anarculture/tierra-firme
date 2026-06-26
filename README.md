# monitorVE

Índice/espejo + centro de mando de la crisis sísmica de Venezuela (doblete M7.2/M7.5, 24-jun-2026).
Agrega, deduplica y destila lo que otras webs ya recolectan; añade panel vital, catálogo de
servicios y pronóstico de réplicas. **No es fuente oficial.**

> **Estado: SCAFFOLD.** Solo shells con `TODO(Sx)`. La implementación la mapea `/dudamel` → `BUILD.md`.

## Decisiones de estructura (ley)
Ver `CONTEXT.md`, `docs/adr/`, `CATALOGO-y-PLAN.md` y el plan en `~/.claude/plans/`.
- Somos **índice/espejo**, no sistema de registro. Las otras webs son **Fuentes** (`sources.manifest.json`).
- **Única intake** = señal de resolución ("ya apareció").
- **Capa propia** = clústeres de dedup + resolución + entradas curadas. Nada más.

## Stack
Vanilla JS (sin build) + Node stdlib (`http`/`test`) + JSON estático para lectura + Supabase para la
capa de escritura. Boring, server-light, corre en red mala. Cero deps externas en el scaffold.

## Estructura
```
sources.manifest.json   Fuentes (declarativo, sin adaptadores)
src/model/              Tipos/constantes del dominio (Persona, Reportante, Localización, Clúster…)
src/ingest/             Adaptadores READ-ONLY por Fuente + run.js (orquestador)
src/dedup/              Clústeres persona×localización (enlazar, no fusionar; sesgo a separar)
src/resolucion/         Única intake: markResolved()
src/api/server.js       Lectura: sirve web/ + /api/* (stubs)
src/curated/            Entradas curadas (panel vital, servicios, donaciones)
web/                    SPA shell (mobile-first, offline)
supabase/migrations/    Esquema (stub, sin datos)
```

## Comandos (gates)
```bash
npm test          # node:test — smoke failable (debe pasar)
npm run build     # valida JSON declarativos (failable)
npm run dev       # levanta api + web stub en http://localhost:8787
npm run ingest    # orquestador (no-op en scaffold)
```

## Smoke manual (end-to-end)
1. `npm test` → verde.
2. `npm run build` → "build OK".
3. `npm run dev`, abrir http://localhost:8787 → se ven los 6 pilares y el footer marca `api: ok (stub)`.
4. `curl localhost:8787/api/health` → `{"ok":true,"scaffold":true}`.
5. `npm run ingest` → log "0 adaptadores cableados (scaffold)".

Cuando los 5 pasan, el scaffold está sano y `/dudamel` puede mapear el trabajo faltante.
