# 07 — Clasificación en el chat + desambiguación al reportante

**Tipo:** AFK · **Track:** Chat

## What to build

El corazón de la misión del bot: clasificar cada dump entrante y, cuando una Necesidad se repite,
**preguntarle al reportante en el chat** si es la misma o se necesita más.

- **Clasificación (5 categorías, [CONTEXT.md](../../CONTEXT.md)):** Necesidad nueva ·
  Actualización/resolución · Compra · Entrega · Ruido. (Money-in y routing fuera del PoC.)
- **Desambiguación** ([ADR 0007](../adr/0007-reconciliacion-necesidades.md)): mención nueva de
  `destino+insumo` con una instancia abierta → el bot responde: *"Ya tengo registrado que el Pérez
  necesita gasas (hace 3h). ¿Es lo mismo o se necesitan más?"* La respuesta del reportante decide:
  "lo mismo" → `reportes++`; "más" → sube cantidad, o abre instancia nueva si la anterior está resuelta.
- El reportante rompe el empate en tiempo real (no el operador). Es la feature C (dedup anti-ruido).

## Acceptance criteria

- [x] Un dump se clasifica en una de las 5 categorías (ruido se descarta) — `clasificar` (LLM) + `rutear`.
- [x] Necesidad repetida con instancia abierta → el bot pregunta "¿lo mismo o más?" (`rutear`→`desambiguar`+`preguntaDesambiguacion`).
- [x] "lo mismo" → `reportes++`; "más" → sube cantidad (`resolverDesambiguacion`).
- [x] Ninguna resolución se auto-acciona sin la respuesta del reportante (rutear no muta en colisión; espera).
- [x] `node --test` cubre el ruteo de las 5 categorías y la lógica mismo/más.

_Engine puro en `src/clasifica.js` (testeado). CLI: `node scripts/libro.js clasifica "<msg>"` / `desambigua`.
La entrega de la pregunta EN EL CHAT la hace el bot bidireccional (#06) mandando `preguntaDesambiguacion`;
la máquina de estado conversacional stateful (recordar qué se preguntó) queda como ceiling ponytail post-PoC._

## Blocked by

- #06 — Bot bidireccional (necesita responder en el chat)
- #01 — Necesidad: identidad open-instance
