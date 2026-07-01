# ingesta-05 — Adapters livianos: donaciones + mascotas + fact-check

**Tipo:** AFK

## What to build

Tres fuentes chicas del plan (F4), agrupadas por ser triviales:
- **donaciones** (`aje`, `caritas`) → categoría `donacion`: orgs verificadas + cuentas banco/PayPal.
  Exposición `curada` (no scrape frágil) — pueden vivir en `src/curated/` con un normalize mínimo.
- **mascotas** (`huellascan`) → categoría `mascota`: búsqueda de mascotas perdidas.
- **desinformación** (`factchequeado`) → categoría `desinformacion`: `link-only`, solo enlazar/listar.

## Acceptance criteria

- [ ] `donacion`: bundle con orgs + cuentas (RIF/PayPal), atribuido; sin inventar cuentas.
- [ ] `mascota`: `fetchRegistros()` + `normalize()` → `{categoria:"mascota", payload, coords?}`.
- [ ] `desinformacion`: lista de fact-checks (título + URL), sin copiar el contenido ajeno.
- [ ] Cada uno wired a `BUNDLES`; `node --test` verde con un test de `normalize` por fuente.

## Blocked by

None - can start immediately.
