# Issues locales — Tierra Firme (modelo ops+contabilidad)

Backlog reescrito sobre el modelo reencuadrado en la grilla del 30-jun/1-jul 2026
(ver [CONTEXT.md](../../CONTEXT.md) + ADRs 0004–0007). Slices verticales tracer-bullet, uno por
archivo. No es GitHub Issues (local, deliberado). Grabbea por número.

**El modelo en una línea:** herramienta interna de un Grupo de apoyo para el loop
dinero→compra→entrega; 3 bitácoras ligables-opcional (Necesidad/Compra/Entrega), estado derivado
de eventos, bot bidireccional que clasifica y desambigua en el chat, dos superficies públicas
(informe de compras + lista recortada) con compuerta humana.

## Track Libro (la contabilidad)

| # | Título | Blocked by |
|---|--------|-----------|
| [01](01-necesidad-identidad-estado.md) | Necesidad: identidad open-instance + estado | — |
| [02](02-compra-bitacora.md) | Compra: intake texto → libro + liga → `comprada` | 01 |
| [03](03-entrega-comprobante.md) | Entrega + foto-comprobante → `entregada`/`verificada` | 01 |
| [04](04-informe-de-compras.md) | Informe de compras auto-generado (web + PDF) | 02 |
| [05](05-lista-publica-recortada.md) | Lista pública recortada (`vigente` only) | 01 |

## Track Chat (la fricción, habilitado por el webhook)

| # | Título | Blocked by |
|---|--------|-----------|
| [06](06-bot-bidireccional.md) | Bot bidireccional (webhook 2 vías) — **enabler** | — |
| [07](07-clasificacion-desambiguacion-chat.md) | Clasificación 5-cat + desambiguación al reportante | 06, 01 |
| [08](08-confirmacion-inline-chat.md) | Confirmación inline de Compra/Entrega en chat | 06, 02, 03 |

## OCR y Operación

| # | Título | Blocked by |
|---|--------|-----------|
| [09](09-foto-ocr-necesidad-y-factura.md) | Foto → OCR → Necesidad o Compra (factura) | 01, 02 |
| [10](10-maps-links.md) | Maps links por Necesidad | 05 |
| [11](11-skill-deploy.md) | Skill deploy/update (informe + lista → gh-pages) | 04, 05 |

## Rutas

- **Arrancables ya:** **01** (raíz del Libro) y **06** (raíz del Chat, en paralelo).
- **Camino más corto a un PoC demostrable:** 01 → 02 → 04 (dump texto → libro → informe). Eso solo
  ya reemplaza su proceso manual del PDF.
- **El habilitador de fricción:** 06 → 07/08 (todo lo del chat). Es la pieza grande.

## Qué pasó con el set viejo (modelo "lista pública")

- **Cerrada — resuelta por ADR:** "modelo estado+ID" (era HITL) → [ADR 0005](../adr/0005-estado-derivado-de-eventos.md)
  + [ADR 0007](../adr/0007-reconciliacion-necesidades.md). Ya no es una issue.
- **Reescritas:** estado end-to-end / operador-setea → 01–03 (estado derivado, no tecleado);
  proof-of-delivery → 03 (núcleo, no add-on); VLM→analiza → 09 (partido en necesidad + factura).
- **Diferida:** conector ayudaencamino → export opcional post-PoC (no bloquea nada).
