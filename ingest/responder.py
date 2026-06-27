#!/usr/bin/env python3
"""Responder de queries para los buzones — v2 skeleton.

Dado el texto de un mensaje entrante, decide si es una *consulta* (ej. "¿dónde
hay centro de acopio en X?") y devuelve una respuesta basada SOLO en datos
verificados de data/bundles/centros.json. Si no es consulta, devuelve None y el
mensaje sigue su curso normal (intake -> /sitrep). Nunca inventa: si no hay
centro verificado en la zona, lo dice.

ponytail: router por keywords, sin LLM. La forma (buscar_centros como "tool")
queda para enchufar Gemini cuando haya queries libres. Match de zona = texto
exacto (substring sin acentos); aliasing de sectores (santa paula->cafetal) es
v2.1, no skeleton.

Uso:
  python3 responder.py --selftest
  python3 responder.py "¿dónde dono comida en Altamira?"   # prueba manual
"""
import json, os, re, sys, unicodedata

CENTROS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "data", "bundles", "centros.json")

# emergencia: si el mensaje pide auxilio de vida, NO buscar — dar canal oficial.
_EMERGENCIA = ("emergencia", "atrapad", "herid", "derrumbe", "rescate",
               "auxilio", "socorro", "sepultad", "escombros")
_EMERGENCIA_REPLY = (
    "🚨 Si hay vidas en riesgo llamá al *171* (emergencias) o a Protección Civil. "
    "Este canal no atiende emergencias en vivo; podés reportar tu zona y la verificamos.")

# intención "consulta de acopio": pide un centro / dónde donar.
_INTENT = ("acopio", "donar", "dono", "donde dono", "donde hay", "donde queda",
           "donde puedo", "punto de", "centro de")

# palabras que NO son lugar — se descartan al extraer la zona de la consulta.
_STOP = {"donde", "dond", "hay", "queda", "puedo", "centro", "centros", "acopio",
         "donar", "dono", "comida", "agua", "ropa", "medicina", "medicinas",
         "necesito", "busco", "quiero", "para", "esta", "este", "como", "cual",
         "sector", "calle", "avenida", "entre", "frente", "edificio", "local",
         "municipio", "parroquia", "zona", "cerca", "punto", "ayuda", "buenas"}

_CENTROS = None  # cache lazy


def _norm(s):
    """minúsculas y sin acentos — para comparar zona vs datos."""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return s.lower()


def _load():
    global _CENTROS
    if _CENTROS is None:
        with open(CENTROS_PATH) as f:
            items = json.load(f)["items"]
        # solo verificados con dirección — nunca devolvemos sin confirmar.
        _CENTROS = [x["payload"] for x in items
                    if x["payload"].get("status") == "verificado" and x["payload"].get("address")]
    return _CENTROS


def buscar_centros(text, limit=3):
    """Centros verificados cuya ubicación (muni/estado/dirección/nombre) menciona
    algún token-lugar de la consulta. Ordena por nº de coincidencias. Sin LLM."""
    q = _norm(text)
    place_tokens = [t for t in re.findall(r"[a-z]{4,}", q) if t not in _STOP]
    if not place_tokens:
        return []
    scored = []
    for p in _load():
        hay = _norm(f"{p.get('name','')} {p.get('municipio','')} {p.get('estado','')} {p.get('address','')}")
        score = sum(1 for t in place_tokens if t in hay)
        if score:
            scored.append((score, p))
    scored.sort(key=lambda sp: sp[0], reverse=True)
    return [p for _s, p in scored[:limit]]


def _fmt(matches):
    out = ["📍 Centros de acopio *verificados* en esa zona:"]
    for p in matches:
        loc = p.get("address", "")
        muni = p.get("municipio") or p.get("estado") or ""
        out.append(f"• *{p.get('name','(sin nombre)')}* — {loc}" + (f" ({muni})" if muni else ""))
        needs = ", ".join(n.get("key", "") for n in p.get("needs", []) if n.get("key"))
        if needs:
            out.append(f"  necesita: {needs}")
    out.append("\nDatos verificados; confirmá horario antes de ir.")
    return "\n".join(out)


def responder(text):
    """text -> respuesta (str) si es consulta de acopio, si no None.
    Orden: emergencia > consulta-con-match > consulta-sin-match > no-consulta."""
    if not text or not text.strip():
        return None
    q = _norm(text)
    if any(k in q for k in _EMERGENCIA):
        return _EMERGENCIA_REPLY
    if not any(k in q for k in _INTENT):
        return None  # no es consulta -> sigue a intake / sitrep
    matches = buscar_centros(text)
    if not matches:
        return ("Por ahora no tengo un centro de acopio *verificado* para esa zona. "
                "Decime el municipio o sector y lo verificamos, o probá con una zona cercana.")
    return _fmt(matches)


def selftest():
    # emergencia gana sobre todo
    r = responder("hay gente atrapada, es una emergencia")
    assert r and "171" in r, r
    # consulta con match (Maracaibo es municipio de un centro verificado)
    r = responder("¿dónde hay centro de acopio en Maracaibo?")
    assert r and "Maracaibo" in r, r
    # match por dirección (Altamira aparece en address, no en municipio)
    r = responder("dónde dono comida en Altamira")
    assert r and _norm("Altamira") in _norm(r), r
    # consulta sin match -> honesto, NO inventa
    r = responder("centro de acopio en Liechtenstein")
    assert r and "no tengo" in _norm(r), r
    # no-consulta (reporte de intake) -> None, el bot calla y deja a /sitrep
    assert responder("necesitamos tapabocas en Perlamar") is None
    assert responder("hola buenas") is None
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif len(sys.argv) > 1:
        print(responder(sys.argv[1]) or "(None — no es consulta de acopio)")
    else:
        sys.exit("uso: responder.py --selftest | responder.py \"<mensaje>\"")
