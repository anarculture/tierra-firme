#!/usr/bin/env python3
"""Responder de queries para los buzones — v3: acopiove en vivo + handoff.

Dado el texto de un mensaje entrante, decide si es una *consulta* y responde con
datos VIVOS de acopiove (centros, teléfonos, personas), con fallback offline a
data/centros.json. Si no es consulta, devuelve None y el mensaje sigue su curso
(intake -> /sitrep). Nunca inventa: si no hay dato, lo dice.

ponytail: router por keywords, sin LLM. HTTP por urllib (stdlib, cero deps).
acopiove es read-only, CC-BY-4.0 (atribución en la respuesta). ResponseGrid
(empujar demanda) está cableado pero APAGADO por defecto — ver push_need().

Env:
  TF_OFFLINE=1     fuerza modo offline (solo data/centros.json) — para tests
  ACOPIO_BASE=...  override del endpoint (default api.acopiove.org/v1)
  RG_PUSH=1        habilita el push de demanda a ResponseGrid (default OFF)
  RG_TOKEN=...     Bearer para ResponseGrid (requerido si RG_PUSH=1)

Uso:
  python3 responder.py --selftest
  python3 responder.py "¿dónde dono comida en Altamira?"
"""
import json, os, re, sys, glob, unicodedata, urllib.parse, urllib.request

# --- fuentes ---
ACOPIO_BASE = os.environ.get("ACOPIO_BASE", "https://api.acopiove.org/v1").rstrip("/")
RG_BASE = "https://api.responsegrid.app"
RG_EMERGENCY = "11111111-1111-4111-8111-111111111111"  # Terremoto Venezuela 2026
TIMEOUT = 6
UA = "TierraFirme/1.0 (humanitarian)"
_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

# emergencia: si el mensaje pide auxilio de vida, NO buscar — dar canal oficial.
_EMERGENCIA = ("emergencia", "atrapad", "herid", "derrumbe", "rescate",
               "auxilio", "socorro", "sepultad", "escombros")
_EMERGENCIA_REPLY = (
    "🚨 Si hay vidas en riesgo llamá al *171* (emergencias) o a Protección Civil. "
    "Este canal no atiende emergencias en vivo; podés reportar tu zona y la verificamos.")

# intención "consulta de acopio": pide un centro / dónde donar.
_INTENT_ACOPIO = ("acopio", "donar", "dono", "donde dono", "donde hay", "donde queda",
                  "donde puedo", "punto de", "centro de", "refugio", "albergue")
# intención "buscar persona": desaparecidos.
_INTENT_PERSONA = ("desaparecid", "busco a", "no aparece", "paradero", "ubicar a",
                   "perdid", "se perdio", "estoy buscando")

# palabras que NO son lugar — se descartan al extraer la zona de la consulta.
_STOP = {"donde", "dond", "hay", "queda", "puedo", "centro", "centros", "acopio",
         "donar", "dono", "comida", "agua", "ropa", "medicina", "medicinas",
         "necesito", "busco", "quiero", "para", "esta", "este", "como", "cual",
         "sector", "calle", "avenida", "entre", "frente", "edificio", "local",
         "municipio", "parroquia", "zona", "cerca", "punto", "ayuda", "buenas",
         "refugio", "albergue", "donde"}
# extra para extraer NOMBRE en consulta de persona.
_STOP_PERSONA = _STOP | {"desaparecido", "desaparecida", "persona", "familiar",
                         "paradero", "ubicar", "aparece", "perdido", "perdida",
                         "estoy", "buscando", "mio", "mia", "tio", "tia", "hermano",
                         "hermana", "papa", "mama", "esposo", "esposa", "hijo", "hija"}

_LOCAL = None  # cache lazy del fallback offline


def _norm(s):
    """minúsculas y sin acentos — para comparar zona vs datos."""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return s.lower()


def _get(path, params=None):
    """GET a acopiove. Devuelve la lista `data` o None si falla/offline. Best-effort:
    nunca lanza hacia el flujo del bot."""
    if os.environ.get("TF_OFFLINE") == "1":
        return None
    url = ACOPIO_BASE + path + (("?" + urllib.parse.urlencode(params)) if params else "")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.load(r).get("data")
    except Exception:
        return None


# ---------- centros (acopios / refugios) ----------

def _resolve_local(base="centros.json"):
    """El dir muta (bundles/↔raíz). Busca el archivo por basename."""
    for c in [os.path.join(_DATA_DIR, base)] + glob.glob(os.path.join(_DATA_DIR, "*", base)):
        if os.path.exists(c):
            return c
    return None


def _norm_local(p):
    loc = p.get("municipio") or p.get("estado") or ""
    return {"name": p.get("name", ""), "address": p.get("address", ""), "loc": loc,
            "zona": _norm(f"{p.get('municipio','')} {p.get('estado','')} {p.get('address','')}"),
            "needs": [n.get("key", "") for n in p.get("needs", []) if n.get("key")],
            "contacto": None, "live": False}


def _norm_live(c):
    loc = c.get("ciudad") or ""
    return {"name": c.get("name", ""), "address": c.get("address", ""), "loc": loc,
            "zona": _norm(f"{c.get('ciudad','')} {c.get('pais','')} {c.get('address','')}"),
            "needs": c.get("recibe") or [], "contacto": c.get("contacto"), "live": True}


def _centros_local():
    global _LOCAL
    if _LOCAL is None:
        p = _resolve_local()
        items = json.load(open(p, encoding="utf-8")).get("items", []) if p else []
        _LOCAL = [_norm_local(x["payload"]) for x in items
                  if x.get("payload", {}).get("status") == "verificado" and x["payload"].get("address")]
    return _LOCAL


def _centros():
    """Live (acopiove, abiertos) si hay red; si no, fallback offline verificado."""
    data = _get("/centros", {"estado": "abierto", "limit": 500})
    if data:
        return [_norm_live(c) for c in data if c.get("address")]
    return _centros_local()


def buscar_centros(text, limit=3):
    """Centros cuya zona menciona algún token-lugar de la consulta. Ordena por
    nº de coincidencias. Sin LLM."""
    q = _norm(text)
    place_tokens = [t for t in re.findall(r"[a-z]{4,}", q) if t not in _STOP]
    if not place_tokens:
        return []
    scored = []
    for c in _centros():
        score = sum(1 for t in place_tokens if t in c["zona"])
        if score:
            scored.append((score, c))
    scored.sort(key=lambda sc: sc[0], reverse=True)
    return [c for _s, c in scored[:limit]]


def _fmt_centros(matches):
    out = ["📍 Centros *abiertos/verificados* en esa zona:"]
    live = False
    for c in matches:
        live = live or c.get("live")
        loc = f" ({c['loc']})" if c.get("loc") else ""
        out.append(f"• *{c.get('name','(sin nombre)')}* — {c.get('address','')}{loc}")
        if c.get("needs"):
            out.append(f"  recibe: {', '.join(c['needs'])}")
        if c.get("contacto"):
            out.append(f"  contacto: {c['contacto']}")
    out.append("\nConfirmá horario antes de ir." +
               (" · Datos: AcopioVE (acopiove.org), CC-BY-4.0" if live else ""))
    return "\n".join(out)


# ---------- teléfonos de emergencia ----------

def _telefonos(limit=4):
    data = _get("/telefonos", {"limit": limit})
    return [(t.get("name", ""), t.get("number", "")) for t in (data or []) if t.get("number")]


def _emergencia_reply():
    tels = _telefonos()
    if not tels:
        return _EMERGENCIA_REPLY
    nums = "\n".join(f"• {n} — *{num}*" for n, num in tels)
    return _EMERGENCIA_REPLY + "\n\nTeléfonos oficiales:\n" + nums


# ---------- personas (desaparecidos) ----------

def _buscar_personas(text, limit=3):
    """Búsqueda en acopiove /personas por el nombre extraído. None si offline/sin red."""
    q = " ".join(t for t in re.findall(r"[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}", text)
                 if _norm(t) not in _STOP_PERSONA)
    if len(q) < 2:
        return None
    return _get("/personas", {"q": q, "limit": limit})


def _fmt_personas(rows):
    out = ["🔎 Personas reportadas que coinciden:"]
    for p in rows:
        loc = p.get("ubicacion_general") or "s/d"
        out.append(f"• *{p.get('nombre','')}* — {loc} ({p.get('estado','')})")
    out.append("\nFuente: registros comunitarios (desaparecidosvenezuela.com / SOS Venezuela). "
               "Verificá antes de difundir.")
    return "\n".join(out)


# ---------- ResponseGrid: empujar demanda (APAGADO por defecto) ----------

def push_need(text, category=None, priority="medium"):
    """Empuja una necesidad sensada a ResponseGrid (POST /needs).

    APAGADO salvo RG_PUSH=1 + RG_TOKEN. Es un *write* outward a un sistema de
    terceros sobre una emergencia real → gated a propósito. El pipeline de intake
    decide cuándo invocarlo; el responder de queries NO lo dispara solo.
    Devuelve el dict de respuesta o None. Best-effort: nunca lanza.
    """
    if os.environ.get("RG_PUSH") != "1":
        return None
    token = os.environ.get("RG_TOKEN")
    if not token:
        return None
    body = json.dumps({"description": text, "category": category, "priority": priority}).encode()
    url = f"{RG_BASE}/emergencies/{RG_EMERGENCY}/needs"
    try:
        req = urllib.request.Request(url, data=body, method="POST",
                                     headers={"User-Agent": UA, "Content-Type": "application/json",
                                              "Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.load(r)
    except Exception:
        return None


# ---------- router ----------

def responder(text):
    """text -> respuesta (str) si es consulta, si no None.
    Orden: emergencia > persona > acopio > no-consulta."""
    if not text or not text.strip():
        return None
    q = _norm(text)
    if any(k in q for k in _EMERGENCIA):
        return _emergencia_reply()
    if any(_norm(k) in q for k in _INTENT_PERSONA):
        rows = _buscar_personas(text)
        if rows:
            return _fmt_personas(rows)
        return ("No encontré a esa persona en los registros vivos. Pasá nombre completo y zona, "
                "o reportala en desaparecidosvenezuela.com.")
    if any(_norm(k) in q for k in _INTENT_ACOPIO):
        matches = buscar_centros(text)
        if not matches:
            return ("Por ahora no tengo un centro *verificado/abierto* para esa zona. "
                    "Decime el municipio o sector, o probá una zona cercana.")
        return _fmt_centros(matches)
    return None


def selftest():
    os.environ["TF_OFFLINE"] = "1"  # determinista: solo data local, sin red
    global _LOCAL
    _LOCAL = None
    # emergencia gana sobre todo (offline: sin teléfonos vivos, pero 171 siempre)
    r = responder("hay gente atrapada, es una emergencia")
    assert r and "171" in r, r
    # consulta de acopio con match (Maracaibo y Caracas son zonas verificadas)
    r = responder("¿dónde hay centro de acopio en Maracaibo?")
    assert r and _norm("Maracaibo") in _norm(r), r
    # consulta sin match -> honesto, NO inventa
    r = responder("centro de acopio en Liechtenstein")
    assert r and "no tengo" in _norm(r), r
    # persona offline -> respuesta honesta (sin red, no fabrica)
    r = responder("busco a mi tio Juan Perez, está desaparecido")
    assert r and "no encontre" in _norm(r), r
    # no-consulta (reporte de intake) -> None, el bot calla y deja a /sitrep
    assert responder("necesitamos tapabocas en Perlamar") is None
    assert responder("hola buenas") is None
    # push_need dormido sin RG_PUSH
    assert push_need("necesitan agua en Catia") is None, "push_need debe estar APAGADO"
    print("selftest OK (offline determinista)")

    # smoke live best-effort: no falla si no hay red
    del os.environ["TF_OFFLINE"]; _LOCAL = None
    live = _get("/meta")
    print("smoke acopiove:", "OK" if live else "sin red (ok, hay fallback)")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif len(sys.argv) > 1:
        print(responder(sys.argv[1]) or "(None — no es consulta)")
    else:
        sys.exit('uso: responder.py --selftest | responder.py "<mensaje>"')
