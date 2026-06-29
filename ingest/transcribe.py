#!/usr/bin/env python3
"""Transcribe un audio (opus/ogg/mp3/m4a/wav/...) a texto. Lo usa /sitrep y enriquece.py.

Default: **Gemini nativo** (generateContent + inline_data) — multi-formato, sin ffmpeg,
sin dependencias, reusa la key del stack (ANALIZA_API_KEY/GEMINI_API_KEY). MISMO patrón que
destilador.py. Modelo default **gemini-2.5-flash**: el A/B (jun-2026) lo mostró preciso en jerga
clínica ("Mindray", "terapia intensiva"), rápido (~1.6s) y MÁS DISPONIBLE que pro (que devuelve
503 'high demand' seguido). Subí a gemini-2.5-pro vía TRANSCRIBE_MODEL para máxima precisión
cuando esté arriba. Reintenta los 503/429/500 transitorios con backoff antes de rendirse.

Fallback PII-local con --local: faster-whisper (import PEREZOSO — ya NO es dependencia
obligatoria del repo; solo carga si la pedís). Úsalo cuando el audio no pueda salir de la
máquina.

Uso:
  ANALIZA_API_KEY=... python3 transcribe.py <audio>          # Gemini (default)
  python3 transcribe.py <audio> --local [modelo]             # whisper local (PII, requiere .venv)
  python3 transcribe.py --selftest                           # sin red
Env: TRANSCRIBE_MODEL (def gemini-2.5-flash) · ANALIZA_API_KEY|GEMINI_API_KEY · ECHO_BASE_URL
"""
import base64, json, os, sys, time, urllib.request, urllib.error

API_KEY = os.environ.get("VLM_API_KEY") or os.environ.get("ANALIZA_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
BASE = os.environ.get("ECHO_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
# flash por default: el A/B mostró que para TRANSCRIBIR es igual de preciso que pro/3.1 y ~40×
# más rápido (gemini-3.1-pro-preview "piensa" 75s sobre una transcripción que flash hace en ~1.6s).
# El thinking se reserva para razonamiento/visión, no transcripción. Override: TRANSCRIBE_MODEL.
MODEL = os.environ.get("TRANSCRIBE_MODEL", "gemini-2.5-flash")
PROMPT = ("Transcribe este audio en español de Venezuela, palabra por palabra. Es una nota de "
          "voz de coordinación de crisis (a veces una lista de insumos médicos dictada). "
          "Devuelve SOLO la transcripción, sin comentarios ni encabezados.")

# WhatsApp manda voz como .opus (contenedor ogg); Gemini lo decodifica nativo.
_MIME = {".ogg": "audio/ogg", ".opus": "audio/ogg", ".mp3": "audio/mp3", ".m4a": "audio/mp4",
         ".aac": "audio/aac", ".wav": "audio/wav", ".flac": "audio/flac"}


def _mime(path):
    return _MIME.get(os.path.splitext(path)[1].lower(), "audio/ogg")


def transcribe_gemini(path, retries=3):
    """Audio → texto vía Gemini nativo. Reintenta los 503/429/500 transitorios con backoff
    (estos modelos devuelven 503 'high demand' seguido); tras N intentos lanza limpio."""
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    body = json.dumps({"contents": [{"parts": [
        {"text": PROMPT},
        {"inline_data": {"mime_type": _mime(path), "data": b64}},
    ]}]}).encode()
    url = f"{BASE}/models/{MODEL}:generateContent?key={API_KEY}"
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and i < retries - 1:
                time.sleep(2 ** i)  # backoff 1s, 2s
                continue
            raise
    cands = data.get("candidates")
    if not cands:  # bloqueado por safety o vacío
        return ""
    # filtra partes de razonamiento (thinking models como gemini-3.1-*): solo el texto-respuesta.
    return "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", [])
                   if not p.get("thought")).strip()


def transcribe_local(path, model="small"):
    """Fallback PII-local: faster-whisper. Import PEREZOSO → la dep solo se carga en este path."""
    from faster_whisper import WhisperModel  # dep opcional, no obligatoria
    m = WhisperModel(model, device="cpu", compute_type="int8")
    segments, _info = m.transcribe(path, language="es")
    return " ".join(s.text.strip() for s in segments).strip()


def transcribe(path, model="small", local=False):
    """Audio → texto. Gemini por default; faster-whisper si local=True (PII estricta).
    Firma compatible: callers viejos `transcribe(path)` siguen funcionando (ahora vía Gemini)."""
    if local:
        return transcribe_local(path, model)
    if not API_KEY:
        sys.exit("falta ANALIZA_API_KEY/GEMINI_API_KEY (o usá --local para whisper)")
    return transcribe_gemini(path)


def selftest():
    """Gate sin red: mime por extensión + ruteo local/Gemini con stubs."""
    global API_KEY, transcribe_local, transcribe_gemini
    assert _mime("x.opus") == "audio/ogg" and _mime("x.mp3") == "audio/mp3"
    assert _mime("X.WAV") == "audio/wav" and _mime("z.desconocido") == "audio/ogg"
    API_KEY = "x"
    transcribe_local = lambda p, m="small": f"LOCAL:{os.path.basename(p)}:{m}"
    transcribe_gemini = lambda p: f"GEMINI:{os.path.basename(p)}"
    assert transcribe("a.ogg") == "GEMINI:a.ogg", "default = Gemini"
    assert transcribe("a.ogg", local=True) == "LOCAL:a.ogg:small", "local=True → whisper"
    assert transcribe("a.ogg", model="medium", local=True) == "LOCAL:a.ogg:medium", "modelo pasa al fallback"
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        args = sys.argv[1:]
        local = "--local" in args
        rest = [a for a in args if not a.startswith("--")]
        model = rest[1] if len(rest) > 1 else "small"
        print(transcribe(rest[0], model=model, local=local))
    else:
        sys.exit("uso: transcribe.py <audio> [--local [modelo]] | --selftest")
