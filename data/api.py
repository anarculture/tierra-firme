#!/usr/bin/env python3
"""Tierra Firme — API público (índice/espejo) sobre los snapshots de data/.

Sirve al bot Y al público. Read-only. FastAPI, zero deps extra.

Run:    python3 api.py                 # :8000, Swagger en /docs
Test:   python3 api.py test            # self-check (incluye chequeo de PII)
Gate:   TF_API_KEY=... python3 api.py  # habilita datasets gated (patients)

Postura de seguridad: ALLOWLIST. Solo se sirven los datasets en POLICY, con la
política de campos de cada uno. Un archivo nuevo en data/ NO se expone solo.
"""
import json, os, sys, glob
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

ROOT = os.path.dirname(os.path.abspath(__file__))

# --- licencias (verificadas: acopiove=CC-BY-4.0, ResponseGrid=CC-BY-SA-4.0) ---
OWN   = {"name": "CC-BY-SA-4.0", "attribution": "Tierra Firme", "source": "tierra-firme"}
ACOPIO = {"name": "CC-BY-4.0", "attribution": "acopiove.org", "source": "acopiove"}
SISMO = {"name": "public-domain", "attribution": "sismosve / USGS", "source": "sismosve"}
# Aliado con permiso explícito; data crowdsourced → no verificada (cada registro lleva verificado:false).
ALIADO = {"name": "CC-BY-SA-4.0", "attribution": "Ayuda Venezuela Red (ayuda-venezuela-red.vercel.app), con permiso",
          "source": "ayuda-venezuela-red", "verificado": False}
# Obra combinada: CC-BY-SA-4.0 (share-alike del ecosistema). Atribución obligatoria.
API_LICENSE = "CC-BY-SA-4.0"

# --- ALLOWLIST: dataset público -> archivo + política ---
# drop: campos eliminados de cada registro (frontera PII). gate: requiere API-key.
# facet: campo para /facets. Nada fuera de aquí se sirve.
POLICY = {
    "hospitals": {"file": "hospitals.json",          "license": OWN,    "facet": "state"},
    "centros":   {"file": "bundles/centros.json",    "license": ACOPIO, "facet": "payload.estado"},
    "replicas":  {"file": "bundles/replicas.json",   "license": SISMO},
    "reports":   {"file": "reports.json",            "license": OWN,    "facet": "type",
                  "drop": ["photoUrl"]},
    "ruteo":     {"file": "sheets/ruteo.json",       "license": OWN},
    "missing":   {"file": "missing.json",            "license": OWN,    "facet": "status",
                  "drop": ["contact", "resolutionNote", "resolutionPhotoUrl"]},  # PII: tel familiar fuera
    "patients":  {"file": "patients.json",           "license": OWN,    "gate": True},  # data médica no verificada
    "demanda":   {"file": "bundles/demanda.json",     "license": ALIADO, "facet": "payload.estado"},  # zonas+necesidades (no verificada)
}

app = FastAPI(
    title="Tierra Firme — API público",
    description=f"Índice/espejo read-only de ayuda humanitaria. Licencia de la obra: {API_LICENSE} "
                "(atribución obligatoria + compartir-igual). Datasets gated requieren X-API-Key.",
    version="1.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


def _resolve(relpath):
    """El dir muta: un archivo puede estar en su ruta declarada, en la raíz, o un
    nivel adentro (bundles/ y sheets/ aparecen/desaparecen). Búscalo por basename."""
    p = os.path.join(ROOT, relpath)
    if os.path.exists(p):
        return p
    base = os.path.basename(relpath)
    for cand in [os.path.join(ROOT, base)] + glob.glob(os.path.join(ROOT, "*", base)):
        if os.path.exists(cand):
            return cand
    return p  # no está en ningún lado: load() levantará 503


def load(name):
    """Lee el dataset, tolerante al churn del dir. Falta/half-write → 503, no crash."""
    try:
        with open(_resolve(POLICY[name]["file"]), encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        raise HTTPException(503, detail={"error": "dataset temporarily unavailable", "dataset": name})


def collection(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return []


def field(item, key):
    """Valor top-level o un nivel anidado (payload.estado, patient.status)."""
    if not isinstance(item, dict):
        return None
    if "." in key:
        head, rest = key.split(".", 1)
        return field(item.get(head), rest) if isinstance(item.get(head), dict) else None
    if key in item:
        return item[key]
    for v in item.values():
        if isinstance(v, dict) and key in v:
            return v[key]
    return None


def redact(item, drop):
    if not drop or not isinstance(item, dict):
        return item
    return {k: v for k, v in item.items() if k not in drop}


def check_gate(name, api_key):
    if not POLICY[name].get("gate"):
        return
    expected = os.environ.get("TF_API_KEY")
    if not expected:
        raise HTTPException(503, detail={"error": "gated dataset not configured (set TF_API_KEY)", "dataset": name})
    if api_key != expected:
        raise HTTPException(401, detail={"error": "X-API-Key required", "dataset": name})


@app.get("/")
@app.get("/v1")
def landing():
    return {
        "name": "Tierra Firme API",
        "version": "1.0",
        "license": API_LICENSE,
        "attribution_required": True,
        "docs": "/docs",
        "datasets": {n: f"/v1/{n}" for n in POLICY},
        "note": "Datos read-only. 'missing' omite contacto (PII). 'patients' requiere X-API-Key.",
    }


@app.get("/v1/{name}/facets")
def facets(name: str):
    if name not in POLICY:
        raise HTTPException(404, detail={"error": "unknown dataset", "available": list(POLICY)})
    f = POLICY[name].get("facet")
    if not f:
        raise HTTPException(404, detail={"error": "no facet for dataset", "dataset": name})
    counts = {}
    for it in collection(load(name)):
        v = field(it, f) or "—"
        counts[str(v)] = counts.get(str(v), 0) + 1
    return {"dataset": name, "facet": f, "counts": dict(sorted(counts.items(), key=lambda x: -x[1]))}


@app.get("/v1/{name}")
def dataset(name: str, request: Request, page: int = 1, limit: int = 50,
            x_api_key: str = Header(default=None)):
    if name not in POLICY:
        raise HTTPException(404, detail={"error": "unknown dataset", "available": list(POLICY)})
    pol = POLICY[name]
    check_gate(name, x_api_key)

    items = collection(load(name))
    drop = pol.get("drop")
    if drop:
        items = [redact(it, drop) for it in items]

    # filtro: ?campo=substring (case-insensitive), sobre campos ya redactados
    reserved = {"page", "limit"}
    filters = {k: v for k, v in request.query_params.items() if k not in reserved}
    if filters:
        items = [it for it in items
                 if all((field(it, k) is not None and v.lower() in str(field(it, k)).lower())
                         for k, v in filters.items())]

    total = len(items)
    limit = max(1, min(limit, 100))           # tope público
    page = max(1, page)
    start = (page - 1) * limit
    window = items[start:start + limit]

    body = {
        "dataset": name,
        "total": total,
        "page": page,
        "limit": limit,
        "license": pol["license"],
        "items": window,
    }
    return JSONResponse(body, headers={"Cache-Control": "public, max-age=60"})


def _selftest():
    from fastapi.testclient import TestClient
    os.environ["TF_API_KEY"] = "test-key"
    c = TestClient(app)

    # público OK
    h = c.get("/v1/hospitals").json()
    assert h["total"] > 0 and h["items"], "hospitals vacío"
    assert h["license"]["name"] == "CC-BY-SA-4.0", "falta licencia"

    # FRONTERA PII: missing nunca expone 'contact'
    m = c.get("/v1/missing?limit=100").json()
    assert m["total"] > 0, "missing vacío"
    assert all("contact" not in it for it in m["items"]), "FUGA PII: contact en missing"
    assert all("resolutionNote" not in it for it in m["items"]), "FUGA PII: resolutionNote"
    assert any("name" in it for it in m["items"]), "missing perdió name (debe quedar)"

    # reports sin photoUrl
    r = c.get("/v1/reports?limit=100").json()
    assert all("photoUrl" not in it for it in r["items"]), "FUGA: photoUrl en reports"

    # GATE: patients bloqueado sin key, abierto con key
    assert c.get("/v1/patients").status_code == 401, "patients NO debería abrir sin key"
    p = c.get("/v1/patients", headers={"X-API-Key": "test-key"}).json()
    assert p["total"] > 0, "patients con key vacío"

    # deny-by-default: archivo interno no servido
    assert c.get("/v1/geocode-cache").status_code == 404, "geocode-cache no debe existir"
    assert c.get("/v1/nope").status_code == 404, "404 esperado"

    # filtro + facets + paginación
    f = c.get("/v1/hospitals", params={"state": "Distrito Capital"}).json()
    assert 0 < f["total"] < h["total"], "filtro state no-op"
    assert c.get("/v1/reports/facets").json()["counts"], "facets vacío"
    pg = c.get("/v1/missing", params={"limit": 5}).json()
    assert len(pg["items"]) == 5 and pg["total"] >= 5, "paginación falló"

    print("selftest OK — PII redactada, gate activo, deny-by-default. datasets:", list(POLICY))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        _selftest()
    else:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
