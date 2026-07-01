# 03 — Entrega + foto-comprobante interna → estado `entregada`/`verificada`

**Tipo:** AFK · **Track:** Libro

## What to build

La bitácora de **Entrega**: se registra que insumos llegaron a un Destino, con foto-comprobante
**interna**. Tercera bitácora ([CONTEXT.md](../../CONTEXT.md)). Es el núcleo del pilar de
transparencia (era la vieja "proof-of-delivery", ahora no es add-on).

- Campos: `{id, grupo, items[], destino, foto?, quien_entrego, necesidad_id?, compra_id?, ts}`.
- **Estado derivado** ([ADR 0005](../adr/0005-estado-derivado-de-eventos.md)): ligar una Entrega
  a la Necesidad → `entregada`; si la Entrega tiene **foto-comprobante** → `verificada`.
- **Doble salto** compra→acopio→hospital = **dos Entregas**, sin entidad especial
  ([ADR 0004](../adr/0004-eventos-no-inventario.md)). No se rastrea inventario del acopio.
- **PII/foto:** la foto es interna, **nunca** pública ([ADR 0006](../adr/0006-frontera-interno-publico.md)).
  Riesgo de caras/pacientes. `verificada` = la foto existe en el libro, no que sea pública.

## Acceptance criteria

- [x] Registro de Entrega con items + destino + (opcional) foto + quién entregó.
- [x] Ligar Entrega a Necesidad → estado `entregada`; con foto → `verificada`.
- [x] Un bulk (1 Compra) puede partirse en varias Entregas a distintos destinos.
- [x] La foto-comprobante NO aparece en ninguna vista pública (test de no-fuga).
- [x] `node --test` cubre: entrega sin foto → `entregada`; con foto → `verificada`.

## Blocked by

- #01 — Necesidad: identidad + estado
