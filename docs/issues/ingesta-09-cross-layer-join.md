# ingesta-09 — Cross-layer join (persona ↔ hospital ↔ edificio)

**Tipo:** HITL

## What to build

El valor del ecosistema (§8 F5 plan): **join, no espejo**. Cruzar las capas por identidad —
persona por cédula/nombre, edificio/centro por geo — para responder cosas que ninguna fuente sola
puede: "esta persona reportada desaparecida ¿aparece en una lista de hospital? (→ localizada)",
"¿qué edificios colapsados tienen personas buscadas asociadas por zona?". HITL: exige una decisión
arquitectónica — unificar el dedup (hoy `data/imported/hospitales-sismo/dedup.py` en Python) con el
colector JS, o mantenerlos separados con un puente.

## Acceptance criteria

- [ ] Decisión registrada (ADR): dónde vive el dedup cross-source (JS unificado vs puente a Python).
- [ ] Join persona↔hospital por cédula (HMAC) produce "posible localizado" para revisión humana.
- [ ] Join geo (edificio↔zona↔persona) por `round(lat,lng,4)`.
- [ ] Conservador: un match dudoso va a cola humana (`_confianza`), nunca se afirma solo.
- [ ] `node --test` verde; test del join con datos sintéticos de 2 capas.

## Blocked by

- ingesta-02 (edificios), ingesta-06 (personas gateadas). Idealmente tras varios adapters.
