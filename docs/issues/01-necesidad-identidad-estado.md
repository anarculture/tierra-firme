# 01 — Necesidad: identidad open-instance + estado (intake texto → libro → panel)

**Tipo:** AFK · **Track:** Libro

## What to build

La primera bala trazadora del libro: un dump de texto entra, se destila en una **Necesidad** con
`id` estable y `estado`, y aparece en el panel interno del operador.

Implementa el modelo de dominio base:
- **Identidad open-instance** ([ADR 0007](../adr/0007-reconciliacion-necesidades.md)): `id` =
  `destino + insumo` normalizados, con **una sola instancia ABIERTA a la vez**. Menciones
  repetidas mientras hay una abierta → `reportes++` sobre la misma (dedup anti-ruido). Resolver
  libera el cupo. (La desambiguación *en el chat* llega en #07; aquí el operador la resuelve en el
  panel como fallback.)
- **Estado derivado** ([ADR 0005](../adr/0005-estado-derivado-de-eventos.md)): sin eventos ligados
  = `vigente`. Los estados `comprada`/`entregada`/`verificada` los activan #02/#03. Manuales
  `cancelada`/`por_decidir` = botón del operador (el caso bolsas = `por_decidir`).
- **Destino** entidad ligera: nombre normalizado + tipo `{hospital, punto_apoyo, centro_acopio,
  doctor/persona, otro}` + zona.

Campos de la Necesidad: `{id, grupo, destino{nombre,tipo,zona}, insumo, cantidad?, urgencia,
estado, reportes, ts}`. `grupo` presente aunque el PoC sea de un solo grupo (no impide multi-grupo).

## Acceptance criteria

- [ ] Dump de texto con una necesidad → Necesidad con `id` estable derivado de `destino+insumo`.
- [ ] 5 menciones del mismo `destino+insumo` con instancia abierta → 1 Necesidad `reportes=5`.
- [ ] Resolver (manual) una Necesidad libera el cupo: una mención posterior abre instancia nueva.
- [ ] `vigente` por default; `cancelada`/`por_decidir` seteables por el operador en el panel.
- [ ] El panel interno (`revisar`) lista las Necesidades con su estado.
- [ ] `node --test` cubre la regla de identidad open-instance (mismo/nuevo).

## Blocked by

None - can start immediately.
