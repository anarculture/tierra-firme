# Rastreamos eventos (compra/entrega), no inventario

**Contexto.** Tierra Firme pasó de "sensor de demanda que exporta a otras plataformas" a
herramienta interna de operaciones + contabilidad para un Grupo de apoyo (ver
[CONTEXT.md](../../CONTEXT.md)). El Grupo corre el loop dinero→compra→entrega y quiere
contabilidad/transparencia como pilar. La tentación natural es modelar un almacén: cuánto hay
en cada centro de acopio, entradas y salidas de stock, saldos. Eso es un WMS (warehouse
management system) — un producto entero, con alta carga de captura de datos.

El norte de esta fase es **mínima fricción de adopción, máximo beneficio de eficiencia**: el
Grupo ya trabaja a mano (dump de WhatsApp + PDF nocturno), y solo adoptará algo que exija casi
cero comportamiento nuevo.

**Decisión.** El sistema rastrea **eventos discretos** —una **Compra** ocurrió, una **Entrega**
ocurrió— y **NO estado de inventario** (cuánto stock hay ahora en un acopio). El centro de
acopio es un **Destino** que recibe y redistribuye, pero no llevamos su balance. La
contabilidad y la transparencia se derivan de la **suma de eventos** (compras = cuánto se
gastó; entregas = a quién llegó), no de un balance de almacén. El doble salto
compra→acopio→hospital son simplemente **dos Entregas**, sin entidad "transferencia" ni "stock".

**Considered / rechazadas.**
- **Inventario vivo por acopio (WMS):** daría "cuánto queda", pero exige registrar cada entrada/
  salida con exactitud o el balance miente — fricción altísima, justo lo que el norte prohíbe.
  Además reintroduce el "inventario/sourcing = NO es nuestro" que el modelo original ya descartó
  y que sigue siendo cierto.
- **Entidad Transferencia/Ruta para el doble salto:** más precisión de trazabilidad a costa de
  otro registro obligatorio. El híbrido (dos Entregas ligables-opcional) cubre el caso sin la
  carga.

**Consecuencia.** Reportes = agregaciones de eventos (el Informe de compras del PDF = suma de
Compras del día). Nunca prometemos "stock disponible". Si el Grupo algún día necesita saldos de
almacén, es un producto/fase nueva, no un ajuste — por eso este límite es difícil de revertir y
se documenta aquí. Los campos de enlace entre bitácoras siguen opcionales
([CONTEXT.md](../../CONTEXT.md): bitácoras ligables-opcional).
