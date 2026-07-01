# 08 — Confirmación inline de Compra/Entrega en el chat

**Tipo:** AFK · **Track:** Chat

## What to build

La confirmación de baja fricción (7b opción B de la grilla): cuando alguien reporta una compra o
entrega, el bot hace eco y el comprador confirma **sin salir de WhatsApp**.

- Flujo: "compré 200 gasas a 130" → el bot responde *"Registré: 200 gasas · 130 c/u · 26.132 Bs.
  ¿Correcto? SÍ / editar."* → el comprador confirma con una palabra → la Compra/Entrega entra al
  libro como confirmada (pendiente solo de la revisión batch del operador).
- Reduce la revisión de fin de día a un escaneo: las líneas ya están y ya vienen confirmadas por
  su autor. El informe (#04) se arma solo.
- Complementa el panel: el portal sigue para el batch + la compuerta de publicación; el chat cubre
  lo intraday.

## Acceptance criteria

- [x] Reporte de compra/entrega → el bot responde con el eco estructurado + pide confirmación (`eco`).
- [x] "SÍ" marca la Compra/Entrega como confirmada-por-autor (`confirmar` → `confirmado_por_autor`); "editar" abre corrección.
- [x] Las confirmadas aparecen ya marcadas en el panel batch del operador (✓autor).
- [x] `node --test` cubre el ciclo eco → confirmación → registro.

_Engine puro en `src/confirma.js`. La conversación stateful (bot guarda lo pendiente hasta el "SÍ")
la maneja el bot bidireccional (#06) — ceiling ponytail igual que #07._

## Blocked by

- #06 — Bot bidireccional
- #02 — Compra: bitácora
- #03 — Entrega: bitácora
