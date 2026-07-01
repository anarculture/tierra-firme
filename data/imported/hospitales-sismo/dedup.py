#!/usr/bin/env python3
"""Deduplica el consolidado → un registro por persona, conservando todo.

Regla (conservadora, es dato de vida o muerte — preferimos NO fusionar a fusionar mal):
  1. FUERTE: filas con la misma cédula válida (≥6 díg) = misma persona.
  2. NOMBRE: filas con mismo nombre+apellido se atan a una persona SOLO si no hay
     cédula en conflicto. Si dos cédulas distintas comparten nombre → son 2 personas
     (no se fusionan). Filas sin cédula con nombre que choca contra ≥2 cédulas → ambiguas,
     se dejan separadas y marcadas `_ambiguo`.

Nunca pierde filas: cada persona lleva `_n_filas`, `_fuentes[]` y todas sus apariciones
hospitalarias. Salida: personas.json (gitignored, PII).

Uso:  python3 dedup.py [consolidado.json] [personas.json]
Gate sin red:  python3 dedup.py --selftest
"""
import json, re, sys, os, unicodedata
from collections import Counter, defaultdict


def norm(s):
    s = str(s) if s not in (None, '') else ''           # fuentes mezclan int/str en edad/cédula
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()


def digits(s):
    return re.sub(r'\D', '', str(s) if s not in (None, '') else '')


def cedula_of(r):
    d = digits(r.get('cedula'))
    return d if len(d) >= 6 else ''


def namekey(r):
    # SOLO fusiona por nombre si hay nombre Y apellido. Solo-primer-nombre ("maria")
    # no es identidad → no se fusiona (evita colapsar personas distintas).
    no, ap = norm(r.get('nombres')), norm(r.get('apellidos'))
    return (no + '|' + ap) if (no and ap) else ''


class UF:
    def __init__(s, n): s.p = list(range(n))
    def find(s, x):
        while s.p[x] != x:
            s.p[x] = s.p[s.p[x]]; x = s.p[x]
        return x
    def union(s, a, b): s.p[s.find(a)] = s.find(b)


def dedup(recs):
    n = len(recs)
    uf = UF(n)
    # pass 1: cédula
    by_ced = defaultdict(list)
    for i, r in enumerate(recs):
        c = cedula_of(r)
        if c: by_ced[c].append(i)
    for rows in by_ced.values():
        for j in rows[1:]: uf.union(rows[0], j)
    # pass 2: nombre, sin chocar cédulas
    by_name = defaultdict(list)
    for i, r in enumerate(recs):
        k = namekey(r)
        if k: by_name[k].append(i)
    ambiguous = set()
    for rows in by_name.values():
        ceds = {cedula_of(recs[i]) for i in rows if cedula_of(recs[i])}
        if len(ceds) <= 1:
            for j in rows[1:]: uf.union(rows[0], j)        # mismo nombre, ≤1 cédula → 1 persona
        else:
            # nombre compartido por ≥2 cédulas distintas: cada cédula es su persona;
            # las filas sin cédula quedan ambiguas (no adivinamos).
            for i in rows:
                if not cedula_of(recs[i]): ambiguous.add(i)
    # construir personas
    clusters = defaultdict(list)
    for i in range(n): clusters[uf.find(i)].append(i)

    def best(vals):  # valor no vacío más largo
        vals = [v for v in vals if (v or '').strip()]
        return max(vals, key=len) if vals else ''

    personas = []
    for root, idxs in clusters.items():
        rows = [recs[i] for i in idxs]
        ced = next((cedula_of(r) for r in rows if cedula_of(r)), '')  # dígitos canónicos (único por cluster)
        edades = [norm(r.get('edad')) for r in rows if re.fullmatch(r'\d{1,3}', norm(r.get('edad')) or '')]
        aps = []
        seen = set()
        for r in rows:
            ap = {k: (r.get(k) or '').strip() for k in
                  ('hospital', 'area', 'piso_cama', 'procedencia', 'diagnostico', 'estado', 'fecha', 'hora')}
            sig = (norm(ap['hospital']), norm(ap['area']), norm(ap['estado']))
            if sig not in seen:
                seen.add(sig); aps.append({k: v for k, v in ap.items() if v})
        estados = [a['estado'] for a in aps if a.get('estado')]
        nombres_distintos = len({norm(r.get('nombres')) + '|' + norm(r.get('apellidos'))
                                 for r in rows if (r.get('nombres') or r.get('apellidos'))})
        # confianza EN LA FUSIÓN (no en el dato de origen):
        if len(rows) == 1:
            conf = 'sin_merge'                 # 1 fila: tal cual la fuente, sin riesgo de fusión
        elif ced and nombres_distintos == 1:
            conf = 'alta'                      # misma cédula, mismo nombre
        elif ced:
            conf = 'revisar'                   # MISMA cédula, NOMBRES distintos → bandera roja, ojo humano
        else:
            conf = 'media'                     # fusión por nombre+apellido, sin cédula
        personas.append({
            'nombres': best([r.get('nombres') for r in rows]),
            'apellidos': best([r.get('apellidos') for r in rows]),
            'cedula': ced,
            'edad': Counter(edades).most_common(1)[0][0] if edades else '',
            'sexo': best([r.get('sexo') for r in rows]),
            'hospitales': sorted({norm(a['hospital']) for a in aps if a.get('hospital')}),
            'apariciones': aps,
            'estado': '; '.join(sorted(set(estados))) if estados else '',
            'familiar': best([r.get('familiar') for r in rows]),
            '_match': 'cedula' if ced else 'nombre',
            '_confianza': conf,
            '_nombres_distintos': nombres_distintos,
            '_ambiguo': any(i in ambiguous for i in idxs) and not ced,
            '_fuentes': sorted({(r.get('fuente') or '').strip() for r in rows if (r.get('fuente') or '').strip()}),
            '_n_filas': len(rows),
        })
    personas.sort(key=lambda p: (-len(p['hospitales']), -p['_n_filas']))
    return personas


def selftest():
    R = [
        {'nombres': 'jose', 'apellidos': 'gonzalez', 'cedula': '12.345.678', 'hospital': 'Vargas'},
        {'nombres': 'José', 'apellidos': 'González', 'cedula': '12345678', 'hospital': 'Catia'},   # = fila 0 (misma céd)
        {'nombres': 'jose', 'apellidos': 'gonzalez', 'cedula': '99.999.999', 'hospital': 'HUC'},   # OTRO jose (céd ≠)
        {'nombres': 'maria', 'apellidos': 'perez', 'cedula': '', 'hospital': 'Luciani'},
        {'nombres': 'maria', 'apellidos': 'perez', 'cedula': '', 'hospital': 'Vargas'},             # mismo nombre+apellido, sin céd → 1 persona, 2 hosp
        {'nombres': 'ana', 'apellidos': '', 'cedula': '', 'hospital': 'Catia'},                      # solo primer nombre
        {'nombres': 'ana', 'apellidos': '', 'cedula': '', 'hospital': 'HUC'},                        # NO debe fusionar con la otra ana
        {'nombres': 'luis', 'apellidos': 'mota', 'cedula': '55.555.5', 'hospital': 'Vargas'},        # céd <6 díg → inválida
        {'nombres': 'pedro', 'apellidos': 'soto', 'cedula': '77777777', 'hospital': 'Vargas'},
        {'nombres': 'pablo', 'apellidos': 'ruiz', 'cedula': '77777777', 'hospital': 'Catia'},        # MISMA céd, nombre distinto → _confianza='revisar'
    ]
    p = dedup(R)
    byced = {x['cedula']: x for x in p if x['cedula']}
    assert byced['12345678']['_n_filas'] == 2 and byced['12345678']['_confianza'] == 'alta'
    assert byced['99999999']['_n_filas'] == 1                                    # NO fusionó los dos jose
    maria = [x for x in p if x['nombres'] == 'maria'][0]
    assert maria['_n_filas'] == 2 and len(maria['hospitales']) == 2 and maria['_confianza'] == 'media'
    anas = [x for x in p if x['nombres'] == 'ana']
    assert len(anas) == 2, anas                                                  # solo-primer-nombre NO se fusiona
    conflict = byced['77777777']
    assert conflict['_n_filas'] == 2 and conflict['_confianza'] == 'revisar', conflict  # bandera roja
    ceds = [x['cedula'] for x in p if x['cedula']]
    assert len(ceds) == len(set(ceds))                                           # ninguna cédula repetida entre personas
    print('selftest ok')


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == '--selftest':
        selftest(); sys.exit(0)
    here = os.path.dirname(__file__)
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'consolidado.json')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, 'personas.json')
    recs = json.load(open(src))['records']
    personas = dedup(recs)
    json.dump({'_src': os.path.basename(src), 'n_filas_origen': len(recs), 'personas': personas},
              open(out, 'w'), ensure_ascii=False, indent=0)
    assert sum(p['_n_filas'] for p in personas) == len(recs), 'filas perdidas!'
    assert len([p for p in personas if p['cedula']]) == len({p['cedula'] for p in personas if p['cedula']})
    multi = [p for p in personas if len(p['hospitales']) > 1]
    conf = Counter(p['_confianza'] for p in personas)
    revisar = [p for p in personas if p['_confianza'] == 'revisar']
    print(f"origen: {len(recs)} filas  →  {len(personas)} personas  (-{len(recs) - len(personas)} colapsadas)")
    print(f"  confianza de fusión: {dict(conf)}")
    print(f"  >> REVISAR (misma cédula, nombres distintos): {len(revisar)} personas")
    print(f"  multi-hospital: {len(multi)} total → fuerte(cédula) {sum(1 for p in multi if p['cedula'])}, "
          f"débil(nombre) {sum(1 for p in multi if not p['cedula'])}")
    print(f"  escrito: {out}")
