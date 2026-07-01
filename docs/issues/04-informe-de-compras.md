# 04 — Informe de compras auto-generado (web + PDF)

**Tipo:** AFK · **Track:** Libro

## What to build

La vista pública de transparencia: la **agregación** del log de Compras de un período, calcando
el PDF que el Grupo ya produce a mano ([CONTEXT.md](../../CONTEXT.md): "Informe de compras"). Es
un **subproducto, no una tarea**: se arma solo de las Compras confirmadas; el operador solo revisa
y publica.

- **Contenido:** tabla `N.º · descripción · cant · costo unitario · costo total` + resumen
  (tipos de insumo, unidades, total invertido). Igual que el informe del 26-jun (`data/reportes/`).
- **UX** (ver `CONTEXT.md` + la grilla): botón "Generar informe" en el panel `revisar` → preview
  → botón "Publicar" (compuerta humana — **nunca auto-publica**, [ADR 0006](../adr/0006-frontera-interno-publico.md)).
- **Dos salidas del mismo dato:** página web siempre-fresca (parte de la superficie pública) +
  **PDF** para compartir en WhatsApp (reemplazo directo de su artefacto; skill `htmk-doc` si se
  quiere branded).
- **Regla PII:** costos SÍ públicos, nombres de voluntarios NO. Omite "comprobantes de ingreso"
  (money-in fuera del PoC).

## Acceptance criteria

- [ ] Del log de Compras se genera el informe (tabla + resumen) con los mismos campos que el PDF actual.
- [ ] Preview en el panel; publicar es un paso humano explícito (no automático).
- [ ] Sale como página web y como PDF descargable/compartible.
- [ ] El informe NO incluye nombres de voluntarios ni datos de personas (test de no-fuga PII).
- [ ] `node --test` cubre la agregación (suma de costos, conteo de tipos/unidades).

## Blocked by

- #02 — Compra: bitácora (el informe agrega Compras)
