# Tierra Firme

Herramienta interna de **operaciones + contabilidad** para un Grupo de apoyo en la crisis
sísmica de Venezuela (doblete M7.2/M7.5, 24-jun-2026). Centraliza los reenvíos de WhatsApp
y corre el loop **dinero → compra → entrega**, destilando el caos en **qué hace falta, dónde
y cuánto**, con transparencia de gasto hacia los donantes. **No es fuente oficial.**

> **Modelo.** Tres bitácoras ligables-opcional (**Necesidad / Compra / Entrega**), estado
> **derivado** de eventos (no tecleado), bot bidireccional que clasifica y desambigua en el
> chat, y dos superficies públicas con **compuerta humana**. El lenguaje del dominio vive en
> [`CONTEXT.md`](CONTEXT.md); las decisiones congeladas en [`docs/adr/`](docs/adr/); el norte
> de producto en [`TIERRA-FIRME.md`](TIERRA-FIRME.md).
>
> **Llegaste nuevo?** `npm test` (debe estar verde), luego leé `CONTEXT.md` + `docs/issues/`.

## Loop central

```
reenvío → buzón (intake) → clasifica (5 cat) → LIBRO interno (Necesidad/Compra/Entrega)
        → estado derivado → [compuerta humana] → informe de compras + lista recortada → gh-pages
```

Nada público sin un humano que verifica. **Transparencia con el dinero, privacidad con las
personas**: costos públicos, nombres de voluntarios / detalle de pacientes / foto-comprobante NO.

## El libro (modelo de dominio) — `src/libro.js`

- **Necesidad** — pedido de insumo en un Destino. Identidad *open-instance* (`destino+insumo`,
  una instancia abierta a la vez); estado derivado `vigente → comprada → entregada → verificada`
  (+ manuales `cancelada`/`por_decidir`). ADR 0005 / 0007.
- **Compra** — `items[{insumo,cantidad,costo_unitario}]` + costo_total; alimenta el informe.
- **Entrega** — con foto-comprobante interna; ligar → `entregada`, con foto → `verificada`.

El libro (`data/libro.json`) es **interno y gitignored**. Las dos superficies públicas
(`site/informe.html`, `site/index.html`) se generan de él con recorte PII.

## Comandos

```bash
npm test                              # node:test — el gate (debe estar verde)
npm run build                         # valida los JSON declarativos

# Libro (operador) — src/libro.js vía scripts/libro.js
node scripts/libro.js add-json '<mención(es)>'      # ingesta Necesidad(es) destilada(s)
node scripts/libro.js destila <fecha>               # inbox texto → Necesidades (LLM)
node scripts/libro.js clasifica "<mensaje>"         # clasifica + rutea al libro (#07)
node scripts/libro.js add-compra '<json>'  · ligar <compra> <necesidad>
node scripts/libro.js add-entrega '<json>' · foto-necesidad <img> · foto-factura <img>   # OCR (#09)
node scripts/libro.js ls                            # necesidades + estado derivado

npm run revisar                       # panel interno: libro + generar/publicar informe y lista
npm run publica                       # libro → site/needs.json (lista recortada, solo vigente)
npm run dev                           # server público (site/): lista + informe + /api
npm run deploy                        # genera → [gate humano] → deploy gh-pages (--deploy = push real)

# Buzón Python (intake WhatsApp vía Zavu; selftest = gate sin red)
python3 ingest/zavu_buzon.py --selftest   ·   python3 ingest/reply.py --selftest
```

## Stack

Vanilla JS + Node stdlib (`src/`, `scripts/`) + Python stdlib (`ingest/`). Gemini para
destilar/clasificar/OCR (endpoint OpenAI-compat + nativo). **Sin dependencias externas** —
boring, server-light, corre en red mala. Ver [`CLAUDE.md`](CLAUDE.md).
