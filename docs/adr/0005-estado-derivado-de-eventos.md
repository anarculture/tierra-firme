# El estado de una Necesidad se deriva de eventos, no se teclea

**Contexto.** Una Necesidad transita por el loop compra→entrega. Dos diseños previos (hoy en
`docs/issues/`) propusieron máquinas de estado en conflicto: T1 (`abierta→cubierta→verificada`)
y feat#2 (`{vigente, cubierta, cancelada, por_decidir}`). Ambas asumían que un operador **setea**
el estado a mano. El norte de la fase es mínima fricción: cada campo que un humano debe teclear
es fricción de adopción.

Ya existe el modelo de tres bitácoras ligables-opcional (Necesidad/Compra/Entrega, ver
[CONTEXT.md](../../CONTEXT.md)). Eso abre una alternativa: **derivar** el estado de los eventos
ligados en vez de gestionarlo.

**Decisión.** El **Estado** de una Necesidad es en su mayoría **derivado** de los eventos que
tiene ligados:

- `vigente` — sin Compra ni Entrega ligada.
- `comprada` — Compra ligada, sin Entrega. (Señal anti-doble-compra: no re-comprar lo ya comprado.)
- `entregada` — Entrega ligada, sin foto.
- `verificada` — Entrega ligada **con foto-comprobante**. (El pilar de transparencia.)

Más dos estados **manuales**, no derivables de ningún evento (botón del operador):

- `cancelada` — ya no aplica / duplicada / error.
- `por_decidir` — en disputa (caso bolsas mortuorias, [[bot-gap-reconciliacion-temporal]]).

"Quién lo resolvió" se deriva del actor del evento ligado (`Compra.quién_compró` /
`Entrega.quién_entregó`), no es un campo aparte.

**Considered / rechazadas.**
- **Máquina de estados manual (T1/feat#2):** el operador teclea cada transición — máxima
  fricción, justo lo que el norte prohíbe.
- **Solo `{vigente, resuelta}`:** menos estados, pero pierde `comprada` (el anti-doble-compra,
  que es el beneficio de eficiencia central) y `verificada` (transparencia). Se rechaza por
  quitar valor sin ahorrar fricción — las derivadas cuestan cero.

**Consecuencia.** El operador no gestiona estados: el bot ve "ya compré X" → crea Compra → liga
→ estado pasa a `comprada` solo; el humano solo aprueba en la compuerta. Las issues
`docs/issues/02-04` (modelo de estado + operador setea) se reescriben sobre este modelo:
el "operador setea" queda reducido a los dos estados manuales + ligar/desligar eventos.
Cambiar de estado-derivado a estado-manual después obligaría a migrar datos y reentrenar al
operador — por eso se fija aquí.
