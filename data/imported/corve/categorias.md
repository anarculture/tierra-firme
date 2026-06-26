# Taxonomía de categorías (de corve → init.sql)

Vocabulario de dominio ya pensado para clasificar puntos de ayuda / servicios /
necesidades. **Uso:** el bot de intake lo reusa para mapear `necesidad`/`servicio`
→ categoría en la destilación. Sin riesgo de confianza (es vocabulario de diseño,
no dato de terceros).

| Categoría | Prioridad | Color | Icono | Descripción |
|---|---|---|---|---|
| ASISTENCIA_MEDICA | 1 crítico | #FF0000 | hospital | Asistencia médica y hospitales |
| REFUGIO | 1 crítico | #4ECDC4 | home | Refugios y albergues |
| SUMINISTRO_AGUA | 1 crítico | #3498DB | tint | Puntos de distribución de agua |
| CENTRO_ACOPIO | 2 urgente | #FF6B6B | warehouse | Centros de acopio de insumos |
| COMIDA | 2 urgente | #F39C12 | utensils | Comida y alimentos |
| RECOLECTOR_INSUMOS | 2 urgente | #F39C12 | package | Personas que han recolectado insumos |
| TRANSPORTE_FLETE | 3 normal | #9B59B6 | truck | Servicios de transporte y fletes |
| VOLUNTARIOS | 3 normal | #2ECC71 | users | Voluntarios disponibles |

Nota: prioridad 1=crítico, 2=urgente, 3=normal. Ajustar a tu modelo si hace falta
(p. ej. monitorVE separa `suministro` vs `operativo` en necesidades — TRANSPORTE/
VOLUNTARIOS/RECOLECTOR caen en "operativo").
