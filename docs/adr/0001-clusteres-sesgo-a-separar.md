# Clústeres de identidad: enlazar, no fusionar, con sesgo a separar

**Contexto.** El Índice cruza reportes de personas de varias Fuentes para dar una
búsqueda unificada (su valor central). El error de identidad no es simétrico: una
**fusión falsa** (unir a dos personas reales distintas) borra a una de la búsqueda —
en crisis puede costar una vida; una **separación falsa** (no unir dos reportes de la
misma persona) solo produce un duplicado visible.

**Decisión.** Los Clústeres **enlazan, no fusionan**: cada Registro de fuente original
permanece visible y atribuido. La heurística está **sesgada a separar**: solo afirma
"misma Persona" (**Match confirmado**) con nombre idéntico normalizado + edad (±2) o
zona; lo demás es **Match posible** (sugerido, no colapsa). Todo cruce
*desaparecida × Localización* (p. ej. lista de hospital) es como mucho Match posible y
requiere **confirmación humana**. No se usa el teléfono como señal (es del Reportante).

**Consecuencia.** Un futuro lector verá entradas que "parecen duplicadas" sin
fusionarse: es deliberado. Preferimos ruido visible a esconder a una persona.
