#!/usr/bin/env python3
"""Envío de respuestas al buzón — v2.

maybe_reply() es el único punto que el buzón llama tras guardar un mensaje:
decide la respuesta y, SOLO si REPLY_ENABLED está activo, la envía. Default
OFF = el bot calla hasta que confíes en él (responder es acción saliente
pública: ver RESEARCH).

Decisión: consulta de acopio (responder, sin LLM) → si no, eco destilado del
mensaje (destilador, vía Gemini). Audio sin texto se transcribe antes.

ponytail: send por urllib stdlib (sin httpx), espejo de cómo el buzón ya
llama a su API. WhatsApp: Zavu POST /v1/messages.

Uso:
  python3 reply.py --selftest
"""
import json, os, sys, urllib.request
import responder
import destilador

REPLY_ENABLED = os.environ.get("REPLY_ENABLED", "").lower() in ("1", "true", "yes", "on")

ZAVU_API_KEY = os.environ.get("ZAVU_API_KEY", "")
ZAVU_API = os.environ.get("ZAVU_API", "https://api.zavu.dev")


def send_zavu(to, text, channel="whatsapp"):
    # Zavu unifica los canales: un POST /v1/messages, fallback a SMS automático si WA falla.
    payload = json.dumps({"to": str(to), "channel": channel, "text": text}).encode()
    req = urllib.request.Request(f"{ZAVU_API}/v1/messages", data=payload,
                                 headers={"Authorization": f"Bearer {ZAVU_API_KEY}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status


def maybe_reply(text, channel, dest, audio_path=None, image_path=None):
    """Si REPLY_ENABLED, responde: consulta de acopio (responder) o, si no, el eco
    destilado del mensaje (destilador). Audio sin texto se transcribe (Gemini);
    foto sin texto la lee el VLM (destila_imagen ya da el acuse, no re-destila).
    channel: 'zavu'; dest: E.164. Devuelve el reply o None."""
    if not REPLY_ENABLED:
        return None
    try:  # la capa de respuesta NUNCA debe tumbar el buzón de intake
        if (not text or not text.strip()) and image_path:
            reply = destilador.destila_imagen(image_path)  # foto: el VLM ya da el acuse
        else:
            if (not text or not text.strip()) and audio_path:
                from transcribe import transcribe  # lazy: Gemini solo si llega audio
                text = transcribe(audio_path)
            reply = responder.responder(text) or destilador.destila(text)
        if not reply:
            return None
        if channel == "zavu":
            send_zavu(dest, reply)
        return reply
    except Exception as e:
        print("error en maybe_reply:", e)
        return None


def selftest():
    global REPLY_ENABLED, send_zavu
    # default OFF: no envía aunque sea consulta válida
    assert maybe_reply("centro de acopio en Maracaibo", "zavu", "+58414") is None
    # ON + parches sin red (responder/destilador stub → no toca LLM ni bundle)
    REPLY_ENABLED = True
    sent = []
    send_zavu = lambda d, t: sent.append(("zv", d, t))
    responder.responder = lambda t: "📍 acopio" if t and "acopio" in t else None
    destilador.destila = lambda t: "✅ Recibido (sin verificar)" if t and "agua" in t else None
    # consulta de acopio -> responder, ruteo correcto por dest
    out = maybe_reply("centro de acopio en Maracaibo", "zavu", "+584140001122")
    assert out and sent[-1][:2] == ("zv", "+584140001122"), sent
    # reporte (no consulta) -> eco del destilador
    sent.clear()
    out = maybe_reply("falta agua en Catia", "zavu", "+58424")
    assert out and "Recibido" in out and sent[-1][:2] == ("zv", "+58424"), (out, sent)
    # foto sin texto -> VLM da el acuse directo (no pasa por responder/destila)
    destilador.destila_imagen = lambda p: "✅ Recibido — daño (sin verificar)" if p else None
    sent.clear()
    out = maybe_reply(None, "zavu", "+58412", None, "/x.jpg")
    assert out and "Recibido" in out and sent[-1][:2] == ("zv", "+58412"), (out, sent)
    # nada útil -> ni responder ni destila -> sin envío
    sent.clear()
    assert maybe_reply("hola buenas", "zavu", "+58414") is None and not sent
    print("selftest OK")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else sys.exit("uso: reply.py --selftest")
