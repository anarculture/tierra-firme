#!/usr/bin/env python3
"""Destilador por-mensaje — el eco de Cayapa.

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
import json, os, sys, urllib.request

API_KEY = os.environ.get("GEMINI_API_KEY", "")
BASE = os.environ.get("ECHO_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
MODEL = os.environ.get("ECHO_MODEL", "gemini-2.5-flash-lite")

SYSTEM = (
    "Sos Cayapa, bot de la emergencia por el sismo en Venezuela. Alguien te reenvía "
    "un mensaje crudo (cadena, reporte, o audio transcrito). Resumí en 1-2 líneas qué "
    "necesidad o hecho de crisis reporta y la zona si se menciona. Es un acuse para "
    "quien lo envió: empezá con '✅ Recibido —' y cerrá con '(sin verificar)'. "
    "NO incluyas nombres ni teléfonos de personas. Si el mensaje NO trae información "
    "útil de crisis (saludo, spam, pregunta suelta), respondé exactamente: NADA"
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


def selftest():
    global _chat, API_KEY
    API_KEY = "x"
    _chat = lambda t: ("✅ Recibido — falta de agua en Catia (sin verificar)."
                       if "agua" in t.lower() else "NADA")
    r = destila("hay falta de agua en Catia, pásenlo")
    assert r and "Catia" in r and "sin verificar" in r.lower(), r
    assert destila("hola buenas") is None           # _chat -> NADA -> None
    assert destila("") is None                       # vacío -> None (no llama LLM)
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
