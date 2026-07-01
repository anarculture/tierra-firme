# Tierra Firme — lenguaje del dominio

Glosario vivo del producto: herramienta interna de operaciones + contabilidad para un
**Grupo de apoyo** que corre el loop dinero→compra→entrega en la crisis sísmica VE.
El norte de producto vive en [TIERRA-FIRME.md](TIERRA-FIRME.md); el porqué de las decisiones,
en [docs/adr/](docs/adr/).

## Language

**Grupo (de apoyo)**:
La organización de voluntarios que opera la plataforma: recibe dinero, compra insumos y los
distribuye. Es el **operador interno**, no el público. El PoC sirve a **un** Grupo; el modelo
de datos lleva un campo `grupo` para no impedir multi-grupo después, pero no se construye
tenancy/auth ahora.
_Evitar_: usuario, tenant, cliente (sugieren multi-grupo que no existe aún).

**Necesidad**:
Un pedido de insumos en un **Destino** — "el Pérez Carreño necesita 200 gasas". Una de las
tres bitácoras. Tiene **estado** (vive/resuelta/…, por definir) y **urgencia**. Se marca
resuelta ligándola opcionalmente a una **Compra**/**Entrega**, o solo con "quién la resolvió".
_Evitar_: pedido (se reserva por si el Grupo agrupa varias necesidades), ticket.

**Actualización de necesidad** (resolución/progreso):
Un dump que reporta movimiento sobre una Necesidad existente — "ya compré las gasas del
Pérez", "eso ya no hace falta". El clasificador debe distinguirla de una Necesidad **nueva**:
es el corazón de la misión del bot. "Ya compré X" es a la vez una **Compra** y una
Actualización que resuelve la Necesidad de ese Destino+ítem.
_Evitar_: edición (no muta la Necesidad, la transiciona), duplicado.

**Compra**:
La adquisición de insumos por el equipo de compras, con costo y (opcional) factura. Una de
las tres bitácoras. Es lo que alimenta el **Informe de compras**. Puede existir **sin** citar
una Necesidad (así es el informe de hoy). **Entra de dos formas** (ambas confirmadas por el
comprador en el chat): texto reenviado al bot ("compré 200 gasas a 130 c/u") o **foto de factura
→ OCR** (`src/extract.js`, la misma tecnología del VLM de necesidades), que además guarda el
adjunto de factura.
_Evitar_: gasto, orden de compra.

**Informe de compras**:
La vista pública de transparencia: la **agregación** del log de Compras de un período (ítem,
cantidad, costo unitario, total; resumen tipos/unidades/total invertido). Calca el PDF que el
Grupo ya produce a mano. Es un **subproducto, no una tarea**: se arma solo de las Compras
confirmadas en el chat durante el día; el operador solo revisa y publica (compuerta humana —
nunca auto-publica). Sale en dos formas del mismo dato: página web siempre-fresca + PDF para
compartir en WhatsApp. Omite "comprobantes de ingreso" (money-in fuera del PoC).
_Evitar_: reporte (ambiguo con sitrep), balance (no es contabilidad de partida doble).

**Entrega**:
El traslado de insumos a un **Destino**, con foto-comprobante y "quién entregó". Una de las
tres bitácoras. Una Compra en bulk puede partirse en varias Entregas (200 gasas → 3 hospitales).
_Evitar_: despacho, envío (ambiguos con "compra despachada").

**Destino**:
El lugar hacia donde va una Necesidad/Entrega — entidad **ligera**: nombre normalizado + tipo
`{hospital, punto_apoyo, centro_acopio, doctor/persona, otro}` + zona. Lo justo para agrupar por
lugar ("dónde") y geocodificar; ni WMS ni CRM. Un **centro_acopio** recibe y redistribuye, pero
no llevamos su stock (ver [ADR 0004](docs/adr/0004-eventos-no-inventario.md)): el doble salto
compra→acopio→hospital son dos Entregas.
_Evitar_: almacén, bodega (sugieren inventario que no rastreamos).

**Identidad de Necesidad**:
Qué hace que dos menciones sean "la misma". Regla: `destino + insumo` (normalizados), con **una
sola instancia ABIERTA a la vez**. Mención nueva mientras hay una abierta → el **bot pregunta en
el chat al reportante**: "ya tengo gasas necesitadas para el Pérez, ¿es lo mismo o se necesitan
más?" — el reportante rompe el empate (mismo → `reportes++`; más → sube cantidad, o abre instancia
nueva si la anterior ya se resolvió). Resolver una Necesidad (`entregada`/`verificada`/`cancelada`)
**libera el cupo**: una mención posterior abre instancia fresca. Así el Pérez puede necesitar gasas
varias veces al día sin colapsarse. De aquí sale el `id` estable. Es la feature C (dedup anti-ruido)
+ reconciliación temporal. Ver [ADR 0007](docs/adr/0007-reconciliacion-necesidades.md).
_Evitar_: identidad plana destino+insumo (colapsa recurrentes), dedup por teléfono del reportante.

**Estado (de Necesidad)**:
Dónde está una Necesidad en el loop. Cuatro estados **derivados** de los eventos ligados (cero
tecleo): `vigente` (nada ligado) → `comprada` (Compra ligada, sin Entrega) → `entregada`
(Entrega ligada sin foto) → `verificada` (Entrega ligada **con foto-comprobante**). Más dos
**manuales** (botón del operador): `cancelada` (ya no aplica/duplicada) y `por_decidir` (en
disputa — caso bolsas mortuorias). `comprada` es el anti-doble-compra; `verificada` es el pilar
de transparencia. Ver [ADR 0005](docs/adr/0005-estado-derivado-de-eventos.md).
_Evitar_: abierta/cubierta (vocabulario viejo de las issues), estado tecleado a mano.

**Quién lo resolvió**:
El actor que movió la Necesidad, **derivado** del evento ligado (`Compra.quién_compró` /
`Entrega.quién_entregó`); texto libre opcional si no hay link. No es un formulario aparte.
_Evitar_: responsable asignado (no asignamos, registramos quién actuó).

**Interno vs Público**:
El sistema tiene dos superficies sobre los mismos datos. **Interno** (libro del Grupo, gated):
todo — necesidades+estado, compras+costos+factura, entregas, quién compró/entregó, foto-
comprobante. Es la herramienta de trabajo. **Público** = dos vistas generadas del libro interno,
ambas con compuerta humana: (1) el **Informe de compras** agregado (ítem, cantidad, costo, total,
como el PDF actual) y (2) la **lista de necesidades recortada** (solo `zona + insumo + urgencia`,
y solo necesidades `vigente` — auto-descarta lo `comprada`/`entregada` vía [ADR 0005]
(docs/adr/0005-estado-derivado-de-eventos.md)). Regla corta: **transparencia con el dinero,
privacidad con las personas** — costos SÍ, nombres de voluntarios NO, detalle de pacientes NO.
La foto-comprobante es interna y **nunca** se publica; si un donante quiere verla, el voluntario
se la envía directo. `verificada` = la foto existe en el libro interno, no que sea pública.
El par necesidades-recortadas + informe forma el **ciclo de confianza** que sostiene el
financiamiento externo. Ver [ADR 0006](docs/adr/0006-frontera-interno-publico.md).
_Evitar_: "la salida pública" a secas (ambiguo — di transparencia, lista recortada, o libro interno).

**Bitácoras ligables-opcional (híbrido)**:
Necesidad, Compra y Entrega son registros **independientes y válidos por sí solos**, que se
**ligan opcionalmente** cuando el dato se conoce. Ningún campo de enlace es obligatorio: la
regla es "los campos no obligan, pero ayudan a la organización interna". La reconciliación
(qué Compra cubre qué Necesidad) la hace el LLM/operador, no un FK forzado.
_Evitar_: trazabilidad obligatoria, enlace requerido.

## Flagged ambiguities

_(sin ambigüedades abiertas de la grilla inicial — el modelo de dominio del PoC está resuelto.)_

_(resuelto:)_
- **Identidad de Necesidad** + reconciliación temporal — ver término "Identidad de Necesidad"
  arriba + ADR 0007. Autoridad: bot propone / humano confirma (compuerta), y el reportante
  desambigua en el chat.
- **Clasificación del dump** — 5 categorías PoC: Necesidad nueva · Actualización/resolución ·
  Compra · Entrega · Ruido. **Fuera del PoC:** Donación entrante (money-in, libro paralelo con
  PII de donantes) y Fuera-de-dominio/routing (era del modelo neutral, no del interno).
- **Público vs interno** — ver término "Interno vs Público" arriba + ADR 0006.
