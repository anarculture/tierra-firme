# monitorVE — Índice de crisis (terremoto VE, 24-jun-2026)

Capa de consolidación sobre el ecosistema fragmentado de webs de la crisis: agrega,
deduplica y destila los datos que **otras webs ya recolectan**. No es el dueño del dato
— es un índice derivado, siempre rastreable a su fuente.

## Language

**Índice**:
El sistema en sí: vista derivada, deduplicada y de solo-lectura sobre los registros de
otras webs, siempre rastreable a su fuente. No es el sistema de registro autoritativo.
_Evitar_: base de datos maestra, fuente de verdad.

**Fuente**:
Una web/registro externo que espejamos (AyudaVE, acopiovenezuela, desaparecidos*.com…).
Nunca le escribimos; ella es dueña de sus datos.
_Evitar_: backend, API propia.

**Registro de fuente**:
Un ítem tal como lo publica una **Fuente** — un reporte de persona, un centro de acopio.
Lo espejamos de solo-lectura; la **Fuente** lo posee.
_Evitar_: entrada, dato suelto.

**Señal de resolución**:
La única excepción al solo-lectura: una marca comunitaria de que una persona reportada
"ya apareció" (resuelto). Es una **anotación sobre** un Registro de fuente, no una
mutación de él.
_Evitar_: edición del registro, actualización de la fuente.

**Capa propia**:
Lo único que el Índice escribe: **clústeres de dedup** + **señales de resolución**. Nada
más — no correcciones de datos ajenos, no intake de registros nuevos. BD minúscula; los
registros pesados se regeneran desde las Fuentes en cada corrida.
_Evitar_: nuestra base de datos (sugiere que poseemos los registros — no).

**Clúster**:
Un grupo de **Registros de fuente** que el Índice juzga como la misma entidad real (una
persona, un centro) reportada por varias Fuentes. Se **enlazan, no se fusionan**: cada
registro original sigue visible y atribuido. Sesgado a **separar antes que fusionar**
(una fusión falsa esconde a una persona; una separación falsa solo duplica).
_Evitar_: registro fusionado, merge.

**Match confirmado**:
Clúster donde el Índice **afirma** "misma Persona" (nombre idéntico normalizado + edad o
zona coincidente). Colapsa en los conteos.
_Evitar_: match exacto (la igualdad nunca es exacta entre fuentes).

**Match posible**:
Clúster **sugerido, no afirmado** ("¿posible misma persona?"). No colapsa: ambos registros
se muestran. Todo cruce *desaparecida × Localización* es, como mucho, Match posible hasta
confirmación humana.
_Evitar_: match débil, duplicado probable.

**Persona**:
El *sujeto* que se busca o se localiza. Una sola entidad con **estado** `desaparecida` →
`localizada`. La transición es la **Señal de resolución**. "Hospitalizado" no es una
especie aparte: es una **Localización**.
_Evitar_: víctima, desaparecido-como-tipo (es un estado, no una entidad).

**Reportante**:
Quien llena un reporte (familiar/amigo). Entidad **distinta** de la **Persona**. Su
teléfono es el del contacto, no del sujeto — por eso no se dedupea por teléfono.
_Evitar_: contacto-como-persona.

**Localización**:
Evidencia que ubica a una **Persona** en un lugar conocido: una lista de ingreso a
hospital, un avistamiento. Puede resolver una `desaparecida` (si se confirma) o existir
sola (un ingreso que nadie reportó como desaparecido). El cruce *desaparecida × Localización*
entre Fuentes es el valor central del Índice.
_Evitar_: hospitalizado-como-entidad.

## Flagged ambiguities

_(pendiente: "Fuente primaria" vs agregador, "Verificación" (centro/org/persona),
"Centro de acopio" vs albergue vs hospital, regla de identidad para Clúster.)_
