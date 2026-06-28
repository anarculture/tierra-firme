# Tierra Firme — plan de funcionamiento

Bot de WhatsApp para la crisis sísmica VE (doblete M7.2/M7.5, 24-jun-2026).
Reenvías lo que llega (cadenas, audios, fotos, capturas); Tierra Firme centraliza
el caos y lo destila en información funcional: **qué hace falta, dónde y cuánto** —
para que los recursos se asignen bien y la ayuda llegue donde de verdad se necesita.

## Norte (decidido)

**Tierra Firme = la puerta de entrada WhatsApp única del ecosistema de respuesta.**
No es otra plataforma que compite: es el **sensor de demanda WhatsApp-nativo** que
convierte reenvíos crudos en registros de necesidad estructurados/dedup/geolocalizados,
y **enruta** lo que no le toca a la herramienta especializada que ya existe.

Por qué este norte: el ecosistema tiene 30+ proyectos con mucho solapamiento y "más
ruido que señal", pero **casi ninguno es WhatsApp-nativo** — que es como el venezolano
realmente usa la herramienta a diario. Y nadie hace **captura estructurada de demanda
desde reenvíos crudos de WhatsApp**, que es lo difícil del supply chain humanitario
(no el inventario — eso ya lo hacen otros).

## Loop central

`reenvío → destila (LLM) → dedup + geocode → compuerta humana → torre de control / export`

1. **Ingesta** — texto/audio/foto/captura al número (voz→transcribe, foto→OCR/visión).
2. **Destila** — registros `{tipo: necesidad|oferta|alerta|rumor, item, cantidad, lugar, urgencia, fuente, ts}`.
3. **Dedup + geocode** — agrupa contra `data/bundles/centros.json`; distingue "5 reportes del mismo faltante" de "5 faltantes".
4. **Compuerta humana** — operador revisa borradores antes de confirmar (panel `revisar`). Nada público sin humano.
5. **Salida** — vista torre de control (qué/dónde/cuánto/urgencia) + export a plataformas de oferta.

## Qué hace (features)

- **A. Consulta bidireccional** — preguntar en el chat: "¿dónde hay agua en Catia?", "¿qué necesita el refugio X?".
- **B. Match necesidad↔oferta** — sugiere emparejamientos a un coordinador humano (no logística completa, solo el match + handoff).
- **C. Dedup anti-ruido** — responde al que reenvía: "ya reportado hace 3h / ya resuelto, no hace falta reenviar".
- **D. Señal de resolución** — marca necesidades cubiertas; evita sobre-abastecer lo viral y desabastecer lo invisible (anti-bullwhip).
- **E. Triage + enrutado** — fuera de dominio → dispara al proyecto correcto (la puerta única).

### Tabla de enrutado (feature E)

| Si reenvían… | Enruta a |
|---|---|
| persona desaparecida | LocalizadosVzla / BuscaChat |
| daño estructural de edificio | Sismo Ayuda VE |
| crisis emocional / trauma | Zerena |
| rumor / wallet de donación sospechosa | Confía |

## Qué NO hace (anti-scope)

No reconstruir desaparecidos, salud mental, daño estructural ni verificación — **están
cubiertos y operativos** en el ecosistema. Se enrutan (E). Cada reconstrucción resta foco
y suma al ruido que combatimos.

## Lente supply-chain

- **Demand sensing** = el diferenciador (WhatsApp → demanda estructurada).
- **Control tower** = el mapa dedup+geocode para coordinadores.
- **Allocation** = feature B.
- **Anti sobre-oferta (bullwhip)** = feature D — el mayor aporte logístico.
- **Inventario/sourcing** = NO es nuestro; se exporta a Response Grid / Acopio / ResQLink.

**Métrica norte:** reducir la brecha entre dónde está la necesidad y dónde va la ayuda.

## Fases

- **0 — Consolidar + rebrand:** apagar sesión forkeada vieja, borrar husk `~/Code/monitorVE`, repointar codegraph; rebrand monitorVE→Tierra Firme (README, nombre bot, mensajes); podar el espejo abandonado (`web/` mapa, `src/dedup`, `src/resolucion`, `src/model`, `supabase/`).
- **1 — Demand-sensing MVP:** endurecer ingest→destila→geocode→compuerta→torre de control exportable (base ya existe).
- **2 — Bidireccional + anti-ruido:** features A, C, D.
- **3 — Interop / puerta única:** features E, B; export/API a plataformas de oferta.

Transversal: red mala, poco saldo, voz primero; humano-en-el-loop para lo público; PII fuera de la salida pública.
