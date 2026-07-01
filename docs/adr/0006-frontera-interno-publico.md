# Frontera interno/público: transparencia de gasto pública, PII interna

**Contexto.** El producto pasó de "lista pública de necesidades" a herramienta interna de un
Grupo de apoyo. Eso invierte el default: antes casi todo apuntaba a publicarse; ahora casi todo
es interno y lo público es lo que el Grupo elige mostrar para rendir cuentas. Hay que trazar la
frontera sin filtrar PII (regla dura del proyecto: nombres/teléfonos/ubicación de personas vivas
nunca salen) y sin vaciar el pilar de transparencia.

Dato decisivo: **el Grupo se financia con plata de donantes de afuera** (no solo miembros). Eso
crea una audiencia externa real que necesita confianza *antes* de dar (ver necesidades creíbles)
y *después* de dar (ver que su plata se usó bien).

**Decisión.** Dos superficies sobre los mismos datos:

- **Interno** (libro del Grupo, gated): todo — necesidades+estado, compras+costos+factura,
  entregas, quién compró/entregó, foto-comprobante. La herramienta de trabajo.
- **Público**: dos vistas generadas del libro interno, **ambas con compuerta humana**:
  1. **Informe de compras** agregado (ítem, cantidad, costo, total) — como el PDF actual.
  2. **Lista de necesidades recortada** — solo `zona + insumo + urgencia`, y solo necesidades
     `vigente` (auto-descarta `comprada`/`entregada` vía [ADR 0005](0005-estado-derivado-de-eventos.md)).

Reglas concretas:
- **Costos SÍ** son públicos (pilar de transparencia). **Nombres de voluntarios NO** (no están
  en el PDF; transparencia con el dinero, privacidad con las personas).
- **Detalle de pacientes / contacto NO** — el destila separa PII en campos estructurados; la
  vista pública solo muestra los campos seguros.
- **Foto-comprobante nunca pública.** Es prueba interna. Si un donante quiere verla, el voluntario
  se la envía directo, fuera de la plataforma. `verificada` = la foto existe en el libro, no que
  sea pública.

El par (lista recortada → informe → prueba de buen uso) forma el **ciclo de confianza** que
sostiene el financiamiento externo.

**Considered / rechazadas.**
- **(ii) Necesidades solo internas:** era lo prudente cuando los donantes eran los propios
  miembros (no hay audiencia externa que auto-servir) y cuando una lista pública se ponía vieja y
  mentía. Se rechaza porque (a) los donantes son externos y la lista concreta es activo de
  recaudación, y (b) el modelo de estado derivado (ADR 0005) ahora mantiene la lista fresca
  automáticamente, eliminando el riesgo de mentir/sobre-ofertar que motivaba (ii).
- **Publicar la lista completa (modelo viejo public-first):** filtra PII y detalle operativo;
  se rechaza por la regla dura de PII.
- **Foto pública tras redacción/gate:** más superficie de riesgo de PII (caras/pacientes) por
  poco valor; se rechaza — el voluntario la comparte peer-to-peer si hace falta.

**Consecuencia.** El sitio público que ya existe (gh-pages) se reconvierte en la **lista
recortada** cara-a-donante; no se bota. Toda vista pública se genera del libro interno y pasa por
la compuerta humana. Multi-grupo y coordinación entre grupos (audiencia pública adicional) siguen
fuera de scope del PoC (un solo Grupo). Revertir a public-first o a internal-only obligaría a
recablear qué se sirve y las garantías de PII — por eso se fija aquí.
