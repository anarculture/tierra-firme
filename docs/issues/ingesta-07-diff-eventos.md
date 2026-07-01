# ingesta-07 — Diff/eventos accionables entre corridas

**Tipo:** AFK · **Estado: HECHO** (`src/ingest/diff.js`: identidad por id/cédula/geo, emite
`nuevo`/`cambio-estado`, marca `revision:true` los críticos encontrado/fallecido; sin previo → todo
nuevo. Wire en `run.js main()` → `data/bundles/eventos.json`. Test `test/diff.test.js`).

## What to build

El valor del agente no es solo el dump sino el **cambio** (§6 plan): comparar la corrida actual vs
la previa por bundle y emitir EVENTOS accionables — persona `desaparecido→encontrado`, nuevo
`fallecido`, nuevo colapso de edificio, nuevo centro de acopio. Estos eventos son los que disparan
acción (aviso a familia, ruteo, alerta) y alimentan la compuerta humana.

## Acceptance criteria

- [ ] Tras cada corrida se computa el diff vs snapshot previo por categoría (por id/cédula/geo).
- [ ] Emite una lista tipada de eventos `{tipo, categoria, antes, despues, registro}`.
- [ ] Evento crítico (fallecido nuevo, encontrado nuevo) queda marcado para revisión humana, no público directo.
- [ ] Sin previo (primera corrida) → todo es "nuevo", sin falsos "cambió".
- [ ] `node --test` verde; test del diff con dos snapshots sintéticos.

## Blocked by

- ingesta-01 (watermark facilita el diff incremental; el diff puede empezar con snapshots completos).
