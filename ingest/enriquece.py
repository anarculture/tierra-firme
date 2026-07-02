#!/usr/bin/env python3
"""Enriquecimiento multimodal: media del inbox → texto, para que destila.js /
analiza.js (text-only) la levanten sin cambiar.

Hoy el grueso de la señal de crisis está en fotos (listas de insumos) y notas de
voz; el pipeline de texto las dejaba caer. Esto las convierte a texto y las mete
al `text` del propio record:
  - voz/audio  → transcribe.py (Gemini)
  - imagen     → Gemini vision vía endpoint OpenAI-compat (data-URI base64)
  - pdf/video  → se marcan y se saltan (v1)

Reescribe `inbox/<date>.jsonl` in-place, idempotente (flag `enriched`). Corré
ANTES de destila/analiza; NO en paralelo con el buzón live (truncaría appends).

CERO PII: el prompt de visión pide NO transcribir nombres/teléfonos de personas.

Uso:  python3 enriquece.py 2026-06-26                       # media en inbox/media/
      python3 enriquece.py 2026-06-26 --media-dir "docs/WhatsApp Chat - X/"
      python3 enriquece.py --selftest
Env:  ANALIZA_API_KEY · ANALIZA_BASE_URL (def Gemini OpenAI-compat) · ANALIZA_MODEL

ponytail: sin caché — si re-procesar media molesta por latencia, cachear por hash
luego. Falla de una media no tumba el run: se marca enriched="error" y sigue.
"""
import base64, json, os, sys, urllib.request
from inbox import INBOX

BASE_URL = os.environ.get("ANALIZA_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
API_KEY = os.environ.get("ANALIZA_API_KEY", "")
MODEL = os.environ.get("ANALIZA_MODEL", "gemini-2.5-flash")

AUDIO = {".ogg", ".oga", ".opus", ".mp3", ".m4a", ".wav"}
IMAGE = {".jpg", ".jpeg", ".png", ".webp"}
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

VISION_PROMPT = (
    "Describí en español SOLO lo útil para coordinar ayuda en una crisis (sismo, Venezuela). "
    "Si es una lista de insumos o necesidades, transcribíla ítem por ítem. Si es una foto de "
    "daños o situación, describí qué se ve y la zona si aparece. "
    "CERO PII: NO transcribas nombres, teléfonos ni contactos de personas. Si no hay nada útil, respondé 'sin contenido relevante'."
)


def resolve(rec, media_dir):
    """Ruta absoluta de la media del record. Con --media-dir (exports) resuelve por
    basename; si no, relpath desde inbox/ (lo que escriben los buzones)."""
    m = rec.get("media")
    if not m:
        return None
    return os.path.join(media_dir, os.path.basename(m)) if media_dir else os.path.join(INBOX, m)


def _gemini_vision(path):
    """Imagen → texto vía OpenAI-compat. urllib stdlib, espejo de destila/analiza."""
    if not API_KEY:
        raise RuntimeError("falta ANALIZA_API_KEY")
    ext = os.path.splitext(path)[1].lower()
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    body = json.dumps({
        "model": MODEL, "max_tokens": 1024,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": VISION_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:{MIME.get(ext, 'image/jpeg')};base64,{b64}"}},
        ]}],
    }).encode()
    req = urllib.request.Request(f"{BASE_URL}/chat/completions", data=body,
                                 headers={"content-type": "application/json",
                                          "authorization": f"Bearer {API_KEY}"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.load(r)
    return (data["choices"][0]["message"]["content"] or "").strip()


def _transcribe(path):
    from transcribe import transcribe  # lazy: solo importa si HAY audio que transcribir
    return transcribe(path)


def _merge(rec, enrich, prefix):
    txt = (prefix + enrich).strip()
    rec["text"] = (rec["text"] + "\n" + txt).strip() if rec.get("text") else txt
    rec["enriched"] = True


def enrich_record(rec, media_dir, transcribe_fn, vision_fn):
    """Enriquece un record in-place. Devuelve la acción: voz|imagen|skip|nada|ya|error."""
    if "enriched" in rec:
        return "ya"
    path = resolve(rec, media_dir)
    if not path:
        return "nada"
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in AUDIO:
            _merge(rec, transcribe_fn(path), "[voz] ")
            return "voz"
        if ext in IMAGE:
            _merge(rec, vision_fn(path), "[imagen] ")
            return "imagen"
        rec["enriched"] = "skip"   # pdf/video/otros — v1 no procesa
        return "skip"
    except Exception as e:
        rec["enriched"] = "error"
        print(f"  ⚠ error en {os.path.basename(path)}: {e}")
        return "error"


def run(date, media_dir=None, transcribe_fn=None, vision_fn=None):
    if transcribe_fn is None:
        transcribe_fn = _transcribe  # difiere el import a la 1ra transcripción
    if vision_fn is None:
        vision_fn = _gemini_vision
    fpath = os.path.join(INBOX, f"{date}.jsonl")
    if not os.path.exists(fpath):
        sys.exit(f"sin inbox para {date} ({fpath})")
    recs = [json.loads(l) for l in open(fpath, encoding="utf-8") if l.strip()]
    counts = {}
    for rec in recs:
        a = enrich_record(rec, media_dir, transcribe_fn, vision_fn)
        counts[a] = counts.get(a, 0) + 1
    with open(fpath, "w", encoding="utf-8") as f:
        for rec in recs:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"{fpath}: {dict(counts)} → corré destila/analiza para usar el texto nuevo")


def selftest():
    tf = lambda p: "necesitamos donantes"          # fake transcribe
    vf = lambda p: "lista: gasas, suero, guantes"   # fake vision
    # imagen (export por basename) sin texto previo
    r = {"media": "00003027-PHOTO.jpg", "text": None}
    assert enrich_record(r, "docs/X", tf, vf) == "imagen"
    assert r["text"] == "[imagen] lista: gasas, suero, guantes" and r["enriched"] is True
    # voz con caption previo → append
    r = {"media": "media/1.ogg", "text": "nota:"}
    assert enrich_record(r, None, tf, vf) == "voz"
    assert r["text"] == "nota:\n[voz] necesitamos donantes"
    # idempotencia: 2da pasada no re-procesa
    assert enrich_record(r, None, tf, vf) == "ya"
    # pdf → skip ; sin media → nada
    r = {"media": "doc.pdf", "text": None}
    assert enrich_record(r, None, tf, vf) == "skip" and r["enriched"] == "skip"
    assert enrich_record({"text": "x"}, None, tf, vf) == "nada"
    # resolución de ruta: inbox vs media_dir
    assert resolve({"media": "media/1.jpg"}, None) == os.path.join(INBOX, "media/1.jpg")
    assert resolve({"media": "media/1.jpg"}, "/exp") == "/exp/1.jpg"
    # error de handler → enriched="error", no tumba
    r = {"media": "1.jpg", "text": None}
    boom = lambda p: (_ for _ in ()).throw(ValueError("x"))
    assert enrich_record(r, None, tf, boom) == "error" and r["enriched"] == "error"
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        md = sys.argv[sys.argv.index("--media-dir") + 1] if "--media-dir" in sys.argv else None
        run(sys.argv[1], md)
    else:
        sys.exit('uso: enriquece.py <YYYY-MM-DD> [--media-dir "<dir>"] | --selftest')
