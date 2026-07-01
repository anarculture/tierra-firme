# ingesta-08 — Scheduler autónomo (cron por refresh_minutes)

**Tipo:** HITL

## What to build

Hacer el agente *autónomo*: correr `run.js` en un ciclo, respetando la cadencia por fuente
(`refresh_minutes` del manifiesto — 30 min personas, 1–5 min réplicas, 6 h edificios/acopios) en vez
de un `npm run ingest` manual. HITL porque implica una decisión de despliegue/operación (dónde corre
el cron, cómo se monitorea, límites de rate a las fuentes).

## Acceptance criteria

- [ ] Cada fuente se refresca a su `refresh_minutes`, no todas a la vez.
- [ ] Corridas idempotentes: dos seguidas no duplican ni corrompen bundles (apoya en watermark).
- [ ] Fallo de una fuente N veces seguidas → alerta, no crash del ciclo (extiende `safe()`).
- [ ] Documentado dónde/cómo corre (cron, systemd timer, o worker) — decisión registrada.
- [ ] Respeta rate-limit de fuentes externas (backoff); no las martillea.

## Blocked by

- ingesta-01 (watermark, para que el ciclo sea incremental y no re-baje 107k cada 30 min).
