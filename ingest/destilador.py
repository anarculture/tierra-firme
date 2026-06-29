#!/usr/bin/env python3
"""Destilador por-mensaje — el eco de Tierra Firme.

Dado el texto crudo de UN reenvío (cadena, reporte, audio ya transcrito), devuelve
un acuse corto con lo que el bot entendió, marcado SIN VERIFICAR. Es la respuesta
que ve quien envía — NO publica nada: el mapa sigue mostrando solo lo que un humano
aprueba (pipeline /sitrep intacto). Si el mensaje no tiene info útil de crisis
(saludo, spam, pregunta), devuelve None y el bot calla (el mensaje sigue a intake).

LLM = Gemini nativo (generateContent), misma key/modelo que humanitas.
ponytail: el contenido reenviado SALE a Gemini (PII potencial). Gateado por
REPLY_ENABLED (default off) en reply.py. Para PII local, apuntá a un modelo propio.

Uso:
  GEMINI_API_KEY=... python3 destilador.py "hay falta de agua en Catia, pásenlo"
  python3 destilador.py --selftest   # sin red
"""
import base64, json, os, sys, urllib.request

# Una sola key para todo el stack Gemini. Prefiere VLM_API_KEY (la nueva, con fondos).
API_KEY = os.environ.get("VLM_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("ANALIZA_API_KEY", "")
BASE = os.environ.get("ECHO_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
# Eco en TIEMPO REAL → flash (no lite): la latencia importa, y con costo no-restringido flash
# da mejor comprensión de voz/imagen que lite. Subí a gemini-2.5-pro vía ECHO_MODEL si hace falta.
MODEL = os.environ.get("ECHO_MODEL", "gemini-2.5-flash")

SYSTEM = (
    "Sos Tierra Firme, bot de la emergencia por el sismo en Venezuela. Alguien te reenvía "
    "un mensaje crudo (cadena, reporte, o audio transcrito). Resumí en 1-2 líneas qué "
    "necesidad o hecho de crisis reporta y la zona si se menciona. Es un acuse para "
    "quien lo envió: empezá con '✅ Recibido —' y cerrá con '(sin verificar)'. "
    "NO incluyas nombres ni teléfonos de personas. Si el mensaje NO trae información "
    "útil de crisis (saludo, spam, pregunta suelta), respondé exactamente: NADA"
)

# Español neutro (no voseo): el bot le habla a Venezuela, no a Argentina.
VISION_SYSTEM = (
    "Eres Tierra Firme, bot de la emergencia por el sismo en Venezuela. Te reenvían una "
    "CAPTURA o FOTO (screenshot de WhatsApp, lista de acopio, daño). Transcribe el texto "
    "legible y resume en 1-2 líneas qué necesidad o hecho de crisis muestra y la zona si "
    "aparece. Es un acuse para quien lo envió: empieza con '✅ Recibido —' y cierra con "
    "'(sin verificar)'. NO incluyas nombres ni teléfonos. Si no muestra info útil de "
    "crisis, responde exactamente: NADA"
)

AUDIO_SYSTEM = (
    "Eres Tierra Firme, bot de la emergencia por el sismo en Venezuela. Te reenvían una "
    "NOTA DE VOZ. Escúchala y resume en 1-2 líneas qué necesidad o hecho de crisis dice y la "
    "zona si se menciona (p. ej. una lista de insumos médicos dictada). Es un acuse para quien "
    "lo envió: empieza con '✅ Recibido —' y cierra con '(sin verificar)'. NO incluyas nombres "
    "ni teléfonos. Si no trae info útil de crisis, responde exactamente: NADA"
)


def _chat(text):
    """Gemini nativo generateContent → string. Lanza si falla (el caller captura)."""
    body = json.dumps({"systemInstruction": {"parts": [{"text": SYSTEM}]},
                       "contents": [{"parts": [{"text": text}]}]}).encode()
    req = urllib.request.Request(f"{BASE}/models/{MODEL}:generateContent?key={API_KEY}",
                                 data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    cands = data.get("candidates")
    if not cands:  # bloqueado por safety o respuesta vacía
        return ""
    return "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", [])).strip()


def destila(text):
    """Texto crudo → eco 'esto entendí (sin verificar)', o None si no hay nada útil."""
    if not text or not text.strip() or not API_KEY:
        return None  # sin texto o sin key: el bot calla, el intake sigue igual
    out = _chat(text)
    if not out or out.strip().rstrip(".").upper() == "NADA":
        return None
    return out


def _chat_img(path):
    """Gemini nativo generateContent con imagen inline → string. Lanza si falla."""
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    parts = [{"inline_data": {"mime_type": mime, "data": b64}}]
    body = json.dumps({"systemInstruction": {"parts": [{"text": VISION_SYSTEM}]},
                       "contents": [{"parts": parts}]}).encode()
    req = urllib.request.Request(f"{BASE}/models/{MODEL}:generateContent?key={API_KEY}",
                                 data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    cands = data.get("candidates")
    return "".join(p.get("text", "") for p in cands[0]["content"]["parts"]).strip() if cands else ""


def destila_imagen(path):
    """Foto/captura → eco 'esto entendí (sin verificar)', o None si no hay nada útil."""
    if not path or not os.path.exists(path) or not API_KEY:
        return None
    out = _chat_img(path)
    return None if not out or out.strip().rstrip(".").upper() == "NADA" else out


# WhatsApp manda voz como .opus (contenedor ogg); Gemini lo decodifica nativo (sin ffmpeg).
_AUDIO_MIME = {".ogg": "audio/ogg", ".opus": "audio/ogg", ".mp3": "audio/mp3",
               ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav"}


def _chat_audio(path):
    """Gemini nativo generateContent con audio inline → string. Lanza si falla."""
    mime = _AUDIO_MIME.get(os.path.splitext(path)[1].lower(), "audio/ogg")
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    parts = [{"inline_data": {"mime_type": mime, "data": b64}}]
    body = json.dumps({"systemInstruction": {"parts": [{"text": AUDIO_SYSTEM}]},
                       "contents": [{"parts": parts}]}).encode()
    req = urllib.request.Request(f"{BASE}/models/{MODEL}:generateContent?key={API_KEY}",
                                 data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    cands = data.get("candidates")
    return "".join(p.get("text", "") for p in cands[0]["content"]["parts"]).strip() if cands else ""


def destila_audio(path):
    """Nota de voz → eco 'esto entendí (sin verificar)', o None si no hay nada útil. Gemini
    entiende el audio directo (multi-formato), reemplaza el paso whisper para el eco."""
    if not path or not os.path.exists(path) or not API_KEY:
        return None
    out = _chat_audio(path)
    return None if not out or out.strip().rstrip(".").upper() == "NADA" else out


def selftest():
    global _chat, _chat_img, _chat_audio, API_KEY
    API_KEY = "x"
    _chat = lambda t: ("✅ Recibido — falta de agua en Catia (sin verificar)."
                       if "agua" in t.lower() else "NADA")
    r = destila("hay falta de agua en Catia, pásenlo")
    assert r and "Catia" in r and "sin verificar" in r.lower(), r
    assert destila("hola buenas") is None           # _chat -> NADA -> None
    assert destila("") is None                       # vacío -> None (no llama LLM)
    # imagen: __file__ existe (no abre red, _chat_img stub); rutas/NADA -> None
    _chat_img = lambda p: "✅ Recibido — daño en edificio, Chacao (sin verificar)."
    ri = destila_imagen(__file__)
    assert ri and "Chacao" in ri, ri
    _chat_img = lambda p: "NADA"
    assert destila_imagen(__file__) is None          # NADA -> None
    assert destila_imagen("/no/existe.jpg") is None   # ruta inexistente -> None (no llama LLM)
    # audio: __file__ existe (no abre red, _chat_audio stub); rutas/NADA -> None
    _chat_audio = lambda p: "✅ Recibido — faltan 5 monitores en el Luciani (sin verificar)."
    ra = destila_audio(__file__)
    assert ra and "Luciani" in ra, ra
    _chat_audio = lambda p: "NADA"
    assert destila_audio(__file__) is None             # NADA -> None
    assert destila_audio("/no/existe.opus") is None    # ruta inexistente -> None (no llama LLM)
    API_KEY = ""
    assert destila("falta agua urgente") is None     # sin key -> None
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif len(sys.argv) > 1:
        print(destila(sys.argv[1]) or "(None — nada destilable)")
    else:
        sys.exit('uso: destilador.py --selftest | destilador.py "<mensaje>"')
