# Reconciliación de necesidades: identidad open-instance + desambiguación en el chat

**Contexto.** Una Necesidad es **recurrente**: el Hospital Pérez Carreño puede necesitar gasas
varias veces en un mismo día. Una identidad plana `destino + insumo` colapsaría una necesidad
nueva y legítima contra una anterior ya resuelta — el hueco de reconciliación temporal que la
memoria del proyecto marcó como brecha #1 ([[bot-gap-reconciliacion-temporal]]): `analiza` es
one-shot sin memoria y trata lo cubierto/cancelado como vivo. Hace falta una regla para decidir
"misma vs nueva" y definir **quién** rompe el empate cuando es ambiguo.

**Decisión.**
- **Identidad = `destino + insumo` (normalizados), con una sola instancia ABIERTA a la vez.**
  El `id` estable de una Necesidad sale de aquí.
- Una mención nueva mientras hay una instancia abierta → el **bot pregunta EN EL CHAT al
  reportante**: *"Ya tengo registrado que el Pérez necesita gasas (hace 3h). ¿Es lo mismo o se
  necesitan más?"* El reportante decide: "lo mismo" → `reportes++`; "más" → sube cantidad, o abre
  instancia nueva si la anterior ya estaba resuelta.
- **Resolver** una Necesidad (`entregada`/`verificada`/`cancelada`, ver
  [ADR 0005](0005-estado-derivado-de-eventos.md)) **libera el cupo**: una mención posterior de
  `destino+insumo` abre una instancia fresca.
- Quien rompe el empate es el **reportante en tiempo real**, no el operador en el panel.

Esto requiere el **bot bidireccional** (webhook de WhatsApp de dos vías), que también habilita la
confirmación inline de compras/entregas (portal para batch de fin de día + confirmación en chat
para lo intraday). El bot bidireccional entra al scope del PoC.

**Considered / rechazadas.**
- **Identidad plana `destino+insumo` sin estado:** colapsa necesidades recurrentes legítimas —
  la brecha #1. Rechazada.
- **Desambiguar en el panel del operador:** el operador no sabe si el hospital ya tiene o necesita
  más; el reportante sí. Además carga trabajo al panel. Rechazada a favor de in-chat.
- **Cada mención = su propia Necesidad (sin dedup):** reintroduce el ruido (5 reenvíos = 5
  necesidades) que el producto existe para combatir. Rechazada.
- **Confirmación solo por portal (7b opción A):** menor scope (no webhook), pero obliga al
  voluntario a abrir un portal para cada "ya compré" intraday — fricción que el norte prohíbe.
  Rechazada a favor de bidireccional (opción B), que el usuario optó por construir.

**Consecuencia.** Cierra la brecha #1 de reconciliación temporal. Materializa las features C
(dedup anti-ruido) y D (señal de resolución) de `TIERRA-FIRME.md`. El operador ve necesidades ya
desambiguadas. Depende del webhook bidireccional (pieza mayor, ahora en scope). Volver a un
modelo sin estado o a desambiguación-en-panel obligaría a rehacer intake y reentrenar al grupo.
