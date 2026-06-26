# Handoff: configurar WhatsApp en Meta para el buzón de monitorVE

> Para el compañero que maneja la cuenta de Meta. **No hay terminal ni código aquí** — solo el
> panel de Meta. Tú reúnes las credenciales y conectas el webhook; el dev (con su Claude) levanta
> el bot y te pasa una URL. Coordinan así:
>
> 1. Tú haces la **PARTE A** (reunir credenciales) y se las pasas al dev.
> 2. El dev levanta el bot y te devuelve una **URL de webhook**.
> 3. Tú haces la **PARTE B** (pegar la URL) y la **PARTE C** (probar).

El buzón recibe lo que la gente manda por WhatsApp (voz, fotos, texto) y lo guarda para que luego
se destile. Esto solo deja **lista la conexión de WhatsApp**.

---

## PARTE A — Reunir las credenciales (panel de Meta)

En [developers.facebook.com](https://developers.facebook.com) → tu app (la que ya tienes registrada)
→ producto **WhatsApp**. Reúne estos 4 datos y pásaselos al dev:

1. **Token de acceso permanente** (`WA_TOKEN`)
   - Para algo estable, se crea desde **Business Settings → Users → System Users**: creá (o usá) un
     system user, asignále la app, y generá un token con los permisos
     `whatsapp_business_messaging` y `whatsapp_business_management`.
   - *(El token temporal de la pantalla "API Setup" sirve para probar pero caduca en 24 h — mejor el permanente.)*

2. **App Secret** (`WA_APP_SECRET`)
   - **App → Settings → Basic → App Secret** (botón *Show*). Es obligatorio: con él se valida que
     los mensajes vienen de verdad de Meta y no de un impostor.

3. **Verify token** (`WA_VERIFY_TOKEN`)
   - **Te lo inventás vos** (cualquier palabra/frase, ej. `monitorve-2026`). No es de Meta. Lo usás
     en la PARTE B y se lo pasás al dev — tienen que poner el mismo.

4. **Número de WhatsApp Business** de la app (el que la gente va a mensajear).

> Pasáselos al dev por un canal seguro (no por chat público). El `WA_TOKEN` y el `WA_APP_SECRET`
> son secretos — quien los tenga puede actuar como tu número.

---

## PARTE B — Conectar el webhook (cuando el dev te pase la URL)

El dev te devuelve una URL tipo `https://algo.trycloudflare.com`. En el panel:

**WhatsApp → Configuration → Webhook → Edit:**
- **Callback URL**: la URL que te pasó el dev.
- **Verify token**: el mismo `WA_VERIFY_TOKEN` que inventaste en la PARTE A.
- Guardá. Meta hace una verificación automática; si el token coincide, queda **Verified ✓**.
  (Si falla: la URL no está corriendo, o el verify token no coincide con el del dev.)

Luego, en **Webhook fields**, **Subscribe** al campo **`messages`**.

---

## PARTE C — Probar

Mandá una **nota de voz** al número de WhatsApp Business. Avisale al dev: él confirma que el mensaje
llegó al buzón (aparece un archivo nuevo del lado del bot). Si llegó, está funcionando.

---

## Notas
- **La URL es temporal:** mientras se prueba, la URL del dev cambia cada vez que reinicia el bot —
  habrá que re-pegarla en la PARTE B. Para una URL **fija** hace falta un dominio (paso aparte, después).
- **Privacidad:** lo que recibe el buzón incluye el teléfono de quien escribe (dato sensible). Se
  guarda en privado entre verificadores, nunca público. El borrador que se publique no lleva
  nombres ni teléfonos de personas.
