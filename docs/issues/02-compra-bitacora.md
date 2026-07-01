# 02 — Compra: intake texto → libro + liga opcional → estado `comprada`

**Tipo:** AFK · **Track:** Libro

## What to build

La bitácora de **Compra**: el comprador reenvía texto ("compré 200 gasas a 130 c/u") → se destila
a un registro de Compra en el libro. Segunda de las tres bitácoras
([CONTEXT.md](../../CONTEXT.md)).

- Campos: `{id, grupo, items[{insumo, cantidad, costo_unitario}], costo_total, factura?,
  quien_compro, necesidad_id?, ts}`. `factura` y `necesidad_id` **opcionales** (bitácoras
  ligables-opcional).
- **Liga opcional a Necesidad:** cuando se conoce el `destino+insumo`, ligar a la Necesidad
  abierta. Al ligar, el estado de esa Necesidad se **deriva** a `comprada`
  ([ADR 0005](../adr/0005-estado-derivado-de-eventos.md)) — la señal anti-doble-compra.
- Una Compra puede existir **sin** Necesidad ligada (así es el informe de hoy).

Nota: aquí la Compra entra por texto y el operador la revisa/liga en el panel. La confirmación
inline en el chat es #08; la factura-OCR es #09.

## Acceptance criteria

- [x] Texto de compra → registro Compra con items, costo_unitario, costo_total.
- [x] Ligar una Compra a una Necesidad abierta deriva el estado de esa Necesidad a `comprada`.
- [x] Compra sin Necesidad ligada es válida y persiste.
- [x] La Compra aparece en el panel interno del operador.
- [x] `node --test` cubre: liga → estado `comprada`; compra suelta sin liga.

## Blocked by

- #01 — Necesidad: identidad + estado (para poder ligar y derivar estado)
