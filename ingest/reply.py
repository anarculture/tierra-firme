#!/usr/bin/env python3
"""Envío de respuestas a los buzones — v2.

maybe_reply() es el único punto que ambos buzones llaman tras guardar un
mensaje: decide la respuesta y, SOLO si REPLY_ENABLED está activo, la envía por
el canal correcto. Default OFF = el bot calla hasta que confíes en él (responder
es acción saliente pública: ver RESEARCH).

Decisión: consulta de acopio (responder, sin LLM) → si no, eco destilado del
mensaje (destilador, vía Gemini). Audio sin texto se transcribe antes.

ponytail: send por urllib stdlib (sin httpx), espejo de cómo cada buzón ya
llama a su API. Telegram: sendMessage. WhatsApp: POST a /{phone_id}/messages.

Uso:
  python3 reply.py --selftest
"""
import json, os, sys, urllib.parse, urllib.request
import responder
import destilador

REPLY_ENABLED = os.environ.get("REPLY_ENABLED", "").lower() in ("1", "true", "yes", "on")

TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
WA_TOKEN = os.environ.get("WA_TOKEN", "")
WA_PHONE_ID = os.environ.get("WA_PHONE_NUMBER_ID", "")
GRAPH = "https://graph.facebook.com/v21.0"

_HOSP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "hospitales.json")
_HOSP = None


def _hospital(dest):
    """Hospital dueño del número `dest`, o None. Lee data/hospitales.json
    (phone→hospital) una vez; sin archivo → nadie. Compara solo dígitos."""
    global _HOSP
    if _HOSP is None:
        try:
            raw = json.load(open(_HOSP_PATH, encoding="utf-8"))
            _HOSP = {"".join(filter(str.isdigit, k)): v for k, v in raw.items() if not k.startswith("_")}
        except Exception:
            _HOSP = {}
    return _HOSP.get("".join(filter(str.isdigit, str(dest))))


def send_telegram(chat_id, text):
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage?" + urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"})
    with urllib.request.urlopen(url, timeout=15) as r:
        return r.status


def send_whatsapp(to, text):
    payload = json.dumps({"messaging_product": "whatsapp", "to": str(to),
                          "type": "text", "text": {"body": text}}).encode()
    req = urllib.request.Request(f"{GRAPH}/{WA_PHONE_ID}/messages", data=payload,
                                 headers={"Authorization": f"Bearer {WA_TOKEN}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status


def maybe_reply(text, channel, dest, audio_path=None, image_path=None):
    """Si REPLY_ENABLED, responde por el canal: consulta de acopio (responder) o,
    si no, el eco destilado del mensaje (destilador). Audio sin texto se transcribe;
    foto sin texto la lee el VLM (destila_imagen ya da el acuse, no re-destila).
    channel: 'telegram'|'whatsapp'; dest: chat_id|wa_id. Devuelve el reply o None."""
    if not REPLY_ENABLED:
        return None
    try:  # la capa de respuesta NUNCA debe tumbar el buzón de intake
        if (not text or not text.strip()) and image_path:
            reply = destilador.destila_imagen(image_path)  # foto: el VLM ya da el acuse
        else:
            if (not text or not text.strip()) and audio_path:
                from transcribe import transcribe  # lazy: whisper solo si llega audio
                text = transcribe(audio_path)
            reply = responder.responder(text) or destilador.destila(text)
        if not reply:
            return None
        h = _hospital(dest)  # si el que reporta es un hospital, atribuye el eco (detecta misroute + invita a corregir)
        if h:
            reply = f"🏥 *{h.get('nombre','hospital')}* — {reply}\n\n¿Algo mal? Reenvía el dato corregido."
        if channel == "telegram":
            send_telegram(dest, reply)
        elif channel == "whatsapp":
            send_whatsapp(dest, reply)
        return reply
    except Exception as e:
        print("error en maybe_reply:", e)
        return None


def selftest():
    global REPLY_ENABLED, send_telegram, send_whatsapp
    # default OFF: no envía aunque sea consulta válida
    assert maybe_reply("centro de acopio en Maracaibo", "telegram", 1) is None
    # ON + parches sin red (responder/destilador stub → no toca LLM ni bundle)
    REPLY_ENABLED = True
    sent = []
    send_telegram = lambda d, t: sent.append(("tg", d, t))
    send_whatsapp = lambda d, t: sent.append(("wa", d, t))
    responder.responder = lambda t: "📍 acopio" if t and "acopio" in t else None
    destilador.destila = lambda t: "✅ Recibido (sin verificar)" if t and "agua" in t else None
    # consulta de acopio -> responder, ruteo correcto por canal/dest
    out = maybe_reply("centro de acopio en Maracaibo", "telegram", 999)
    assert out and sent[-1][:2] == ("tg", 999), sent
    maybe_reply("centro de acopio en Maracaibo", "whatsapp", "584140001122")
    assert sent[-1][:2] == ("wa", "584140001122"), sent
    # reporte (no consulta) -> eco del destilador
    sent.clear()
    out = maybe_reply("falta agua en Catia", "telegram", 7)
    assert out and "Recibido" in out and sent[-1][:2] == ("tg", 7), (out, sent)
    # foto sin texto -> VLM da el acuse directo (no pasa por responder/destila)
    destilador.destila_imagen = lambda p: "✅ Recibido — daño (sin verificar)" if p else None
    sent.clear()
    out = maybe_reply(None, "telegram", 5, None, "/x.jpg")
    assert out and "Recibido" in out and sent[-1][:2] == ("tg", 5), (out, sent)
    # nada útil -> ni responder ni destila -> sin envío
    sent.clear()
    assert maybe_reply("hola buenas", "telegram", 1) is None and not sent
    print("selftest OK")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else sys.exit("uso: reply.py --selftest")
