# Tareas para el equipo — SIN código

Para ayudantes no técnicos. El cuello de botella de Tierra Firme no es programar, es **datos
verificados** y **config de cuentas**. Cada tarea dice: **quién** puede hacerla, **qué** produce, y
**a dónde enchufa**. La salida de las tareas de datos es texto/planilla → un dev la commitea.

---

## A. Desbloquear el bot (PRIORIDAD)

**A1 · Cuenta Zavu lista.** Quien tiene la cuenta: esperar el aviso de KYC de WhatsApp
(Zavu/Meta lo procesan, nadie lo acelera) y cargar créditos en dashboard.zavu.dev.
→ Produce: número WhatsApp operativo para el bot.

**A2 · Punto de recolección.** Cualquiera. Difundí el número WhatsApp del bot donde la
gente manda el caos, e invitá a los verificadores. → Produce: el buzón donde aterriza todo.

---

## B. Infra / config (cuando el bot funcione)

**B1 · Dominio a Cloudflare.** Quien tiene la cuenta de Spaceship. Crear cuenta Cloudflare (gratis),
*Add a Site* → `planvenezuela.org`, y en Spaceship cambiar los nameservers por los de Cloudflare.
→ Produce: dominio gestionado por Cloudflare (habilita la URL fija del webhook). Click-ops, sin código.

**B2 · (Opcional) Supabase.** Solo si se decide mover el store a Supabase (hoy es JSON, no urge).
Crear proyecto en supabase.com, copiar URL + keys. → Produce: keys para el dev. Sin código.

---

## C. Datos / verificación (el corazón del producto — el mayor valor)

Regla de oro: **cada dato con fuente y fecha. 2+ fuentes independientes = ✓. Una sola = ⏳ (no es
hecho).** Sin nombres/teléfonos de personas vivas en lo público.

**C1 · Centros de acopio.** Verificador. Por cada acopio: dirección exacta, horario, qué reciben,
contacto. Cruzar 2 fuentes. → Produce: filas verificadas (planilla) → `src/curated` (centros).

**C2 · Cuentas de donación.** Verificador con criterio. Confirmar cuáles son legítimas; marcar las
dudosas / cadenas / estafas. → Produce: lista ✓ / ⚠ con por qué.

**C3 · Hospitales / refugios / morgues.** Verificador. Estado operativo, contacto, capacidad, qué
atienden. → Produce: filas con procedencia + fecha → directorio.

**C4 · Catálogo de servicios.** Verificador. Telemedicina, apoyo psicológico, evaluación
estructural, transporte: confirmar contacto y disponibilidad reales. → Produce: filas verificadas.

**C5 · Borradores de sitrep** (la tarea estrella). Verificador. Monitoreá los canales de crisis
(WhatsApp/IG/Telegram), y por zona redactá el reporte con la plantilla de `/sitrep`: qué cambió,
zonas críticas, necesidades, dónde donar, alertas. Marcá cada dato ✓/⏳ con su fuente. → Produce:
`aprobados.json` que el dev publica con `node scripts/publica-sitrep.js` → aparece en la app con
badge *Verificado ✓*. (Loop completo en `docs/DESTILACION.md`.)

---

## D. Protocolo / contenido

**D1 · Allowlist de fuentes confiables.** Lista de orgs/medios que cuentan como fuente fuerte
(IFRC, OCHA, Cruz Roja, Caracas Chronicle, prensa seria, alcaldías). → Produce: lista de referencia
para los verificadores.

**D2 · Checklist del gate humano.** 1 página: qué cuenta como ✓ (2 fuentes), cómo oler una estafa
(cuenta nueva, urgencia rara, datos que no cuadran), qué NUNCA se publica (PII de personas). →
Produce: el SOP que usan C2 y C5.

**D3 · Mensaje de onboarding ciudadano.** Texto corto: "cómo mandarle info al buzón" — qué mandar
(voz, fotos, ubicación de zona), qué NO (datos de personas en público), y la promesa de privacidad.
→ Produce: copy para difundir + reduce el ruido que llega al inbox.

---

### Orden sugerido
A1/A2 (canales) → C5 + D2 (empezar a producir sitreps verificados ya, aun
sin el bot, con monitoreo manual) → C1–C4 (datos en paralelo) → B1 (URL fija) → B2/resto.

> Nota: C5 y D2 **no necesitan el bot** — se puede empezar a destilar y publicar sitreps verificados
> hoy mismo monitoreando canales a mano. El bot solo automatiza la *entrada*; el valor (verificar y
> ordenar) ya se puede generar.
