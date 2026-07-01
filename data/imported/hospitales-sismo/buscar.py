#!/usr/bin/env python3
"""Busca una persona (cédula o nombre) en nuestra data local + los 2 sheets maestros vivos.

Schema-agnóstico: trata cada registro/fila como texto plano y matchea por dígitos de
cédula (≥6) o por tokens de nombre (acento/caso-insensible). Así sigue sirviendo aunque
los sheets cambien de columnas.

Uso:
  python3 buscar.py 25369306
  python3 buscar.py "aura isabel serrano"
  python3 buscar.py --refresh 29545216      # re-baja los sheets vivos (si no, usa caché)
  python3 buscar.py --selftest

Salida con PII (es para el operador). Los CSV de caché quedan gitignored (*.csv).
"""
import json, re, sys, os, glob, csv, unicodedata, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SHEETS = {  # label -> (cache_file, export CSV url)
    'sheet-vivo-1 · Terremoto Consolidado':
        ('_cache_sheet1.csv',
         'https://docs.google.com/spreadsheets/d/15gUXyoBjsZK8RlixGotv635uY4t1m5Wu/export?format=csv&gid=1545123860'),
    'sheet-vivo-2 · Registro Maestro':
        ('_cache_sheet2.csv',
         'https://docs.google.com/spreadsheets/d/1dl0AnfMqsicKgTpoTjU2tJ5jYRU21HVC/export?format=csv'),
}
UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126 Safari/537.36'


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()


def digits(s):
    return re.sub(r'\D', '', s or '')


def flat(r):
    out = []
    def walk(x):
        if isinstance(x, str): out.append(x)
        elif isinstance(x, dict): [walk(v) for v in x.values()]
        elif isinstance(x, list): [walk(v) for v in x]
    walk(r)
    return ' | '.join(o for o in out if o.strip())


def parse_query(q):
    qdig = digits(q) if len(digits(q)) >= 6 else ''
    qtok = [t for t in norm(q).split() if t.isalpha() and len(t) >= 3]
    thr = len(qtok) if len(qtok) < 3 else len(qtok) - 1   # 1→1, 2→2, 3→2, 4→3
    return qdig, qtok, thr


def match(blob, qdig, qtok, thr):
    if qdig and qdig in digits(blob):
        return 'cédula'
    if qtok and sum(t in norm(blob) for t in qtok) >= thr:
        return f'nombre({sum(t in norm(blob) for t in qtok)}/{len(qtok)})'
    return None


def local_rows():
    rows = []
    for f in sorted(glob.glob(os.path.join(HERE, '*.json'))):
        if os.path.basename(f) == 'combined-records.json':   # intermedio del merge, redundante
            continue
        try:
            d = json.load(open(f))
        except Exception:
            continue
        items = next((d[k] for k in ('personas', 'records', 'results', 'patients', 'missing')
                      if isinstance(d, dict) and isinstance(d.get(k), list)), d if isinstance(d, list) else [])
        for r in items:
            rows.append((os.path.basename(f), flat(r)))
    return rows


def live_rows(refresh):
    rows = []
    for label, (cache, url) in SHEETS.items():
        cp = os.path.join(HERE, cache)
        if refresh or not os.path.exists(cp):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                data = urllib.request.urlopen(req, timeout=25).read()
                if b'<html' in data[:200].lower():
                    raise ValueError('bloqueado (HTML)')
                open(cp, 'wb').write(data)
            except Exception as e:
                print(f"  ⚠ no pude bajar {label}: {e}  (uso caché si existe)", file=sys.stderr)
        if os.path.exists(cp):
            for r in csv.reader(open(cp, encoding='utf-8', errors='ignore')):
                if any(c.strip() for c in r):
                    rows.append((label, ' | '.join(c for c in r if c.strip())))
    return rows


def buscar(query, refresh=False):
    qdig, qtok, thr = parse_query(query)
    sources = local_rows() + live_rows(refresh)
    hits = [(src, blob, why) for src, blob in sources
            if (why := match(blob, qdig, qtok, thr))]
    return qdig, qtok, hits


def selftest():
    rows = [
        ('x', 'URBANO | Julio | Campo Golf | La Guaira'),
        ('x', 'Serrano González | NANCY | Hospital Vargas | 67'),
        ('x', 'Félix Gabriel | Úrbáno | 25.369.306 | HUC'),   # acentos + cédula con puntos
    ]
    def run(q):
        qd, qt, thr = parse_query(q)
        return [r[1] for r in rows if match(r[1], qd, qt, thr)]
    assert run('25369306') == [rows[2][1]], run('25369306')           # cédula con puntos en data
    assert run('felix urbano') == [rows[2][1]], run('felix urbano')   # 2 tokens, acento-insensible
    assert run('aura serrano') == [], run('aura serrano')             # nancy serrano ≠ aura serrano
    assert set(run('urbano')) == {rows[0][1], rows[2][1]}, run('urbano')  # 1 token
    assert run('nancy serrano') == [rows[1][1]]
    print('selftest ok')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--selftest']:
        selftest(); sys.exit(0)
    refresh = '--refresh' in args
    args = [a for a in args if a != '--refresh']
    if not args:
        print(__doc__); sys.exit(1)
    query = ' '.join(args)
    qdig, qtok, hits = buscar(query, refresh)
    print(f"\nBuscando: {query!r}  (cédula={qdig or '—'}, tokens={qtok or '—'})\n")
    if not hits:
        print("  ✗ SIN COINCIDENCIAS en data local + sheets vivos.")
    else:
        bysrc = {}
        for src, blob, why in hits:
            bysrc.setdefault(src, []).append((why, blob))
        for src, items in bysrc.items():
            print(f"  ── {src} ({len(items)}) ──")
            for why, blob in items[:25]:
                print(f"     [{why}] {blob[:200]}")
            if len(items) > 25:
                print(f"     … +{len(items) - 25} más")
        print(f"\n  total: {len(hits)} coincidencias")
