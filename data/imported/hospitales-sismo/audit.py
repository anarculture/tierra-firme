#!/usr/bin/env python3
"""Auditoría de calidad de un dump de pacientes (records JSON) — stdlib pura.

Idea tomada de data-analytics-skills (programmatic-eda + data-quality-audit +
metric-reconciliation), reducida a lo que sirve a ESTE dump. Sin instalar nada.

Uso:  python3 audit.py [consolidado.json]   # default: consolidado.json en este dir
Imprime solo conteos/agregados — NUNCA nombres (PII).
"""
import json, re, sys, os, unicodedata
from collections import Counter

path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'consolidado.json')
_d = json.load(open(path))
recs = _d.get('records') or _d.get('personas') or []   # acepta flat (records) o deduped (personas)
N = len(recs)


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()


def digits(s):
    return re.sub(r'\D', '', s or '')


key = lambda r: norm(r.get('nombres')) + '|' + norm(r.get('apellidos'))

print(f"=== QUALITY AUDIT · {os.path.basename(path)} · {N} registros ===\n")

for f in ['nombres', 'apellidos', 'cedula', 'edad', 'hospital', 'estado', 'familiar']:
    if any(f in r for r in recs):
        have = sum(1 for r in recs if str(r.get(f) or '').strip())
        print(f"  {f:10s} presente: {have:5d}  ({100 * have // N if N else 0:3d}%)")

ced = [digits(r.get('cedula')) for r in recs if len(digits(r.get('cedula'))) >= 6]
dup_ced = [c for c, n in Counter(ced).items() if n > 1]
print(f"\n  cédulas válidas (≥6díg): {len(ced)} · duplicadas: {len(dup_ced)} "
      f"(afectan {sum(Counter(ced)[c] for c in dup_ced)} filas)")

dupname = [k for k, n in Counter(key(r) for r in recs).items() if k != '|' and n > 1]
print(f"  nombre+apellido duplicado: {len(dupname)} personas en >1 fila")

byperson = {}
for r in recs:
    byperson.setdefault(key(r), set()).add(norm(r.get('hospital')))
multi = [k for k, hs in byperson.items() if k != '|' and len({h for h in hs if h}) > 1]
print(f"  personas en MÚLTIPLES hospitales: {len(multi)}")

est = Counter(norm(r.get('estado')) for r in recs if norm(r.get('estado')))
if est:
    fall = sum(n for e, n in est.items() if 'falleci' in e)
    print(f"\n  estados no vacíos: {sum(est.values())} · >> FALLECIDOS marcados: {fall}")
    print(f"  detalle: {dict(est.most_common(12))}")
