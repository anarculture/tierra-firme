#!/usr/bin/env python3
"""Parse + normaliza la hoja de control de pacientes (Sismo VE 2026) a JSON.

Stdlib pura (zipfile + xml), sin deps. La hoja es PII de terceros → el JSON
de salida es gitignored y NO se publica en /v1 (ver README.md).

Uso:
  1. Bajar la hoja vía MCP Google Drive (fileId 1oE5621KFEzd6lptBDtwDuZ_2r2FF2uVg,
     mimeType xlsx) a control.xlsx.
  2. python3 import.py control.xlsx pacientes-control.json

Self-check sin red:  python3 import.py --selftest
"""
import zipfile, sys, json, re
from xml.etree import ElementTree as ET
from collections import Counter

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
FIELDS = ['hospital', 'nombres', 'apellidos', 'ced_o_procedencia', 'edad', 'area', 'otra']
# Solo fusiona variantes inequívocas. Pérez Carreño vs "de la Guaira": SEPARADOS a propósito.
CANON = {
    "domingo luciani": "Hospital Domingo Luciani",
    "hopital domingo luciani": "Hospital Domingo Luciani",
    "hospital domingo luciani": "Hospital Domingo Luciani",
    "hospital vargas": "Hospital Vargas",
    "hospital universitario de caracas": "Hospital Universitario de Caracas (HUC)",
    "campo de golf la guaira": "Hospital de Campaña Campo de Golf (La Guaira)",
    "hospital perez carreño": "Hospital Pérez Carreño",
    "hospital perez carreño de la guaira": "Hospital Pérez Carreño de la Guaira",
}


def _cidx(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_grid(xlsx_path):
    z = zipfile.ZipFile(xlsx_path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall(f'{NS}si'):
            shared.append(''.join(t.text or '' for t in si.iter(f'{NS}t')))
    sheets = sorted(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$', n))
    root = ET.fromstring(z.read(sheets[0]))
    grid = []
    for row in root.iter(f'{NS}row'):
        cells = {}
        for c in row.findall(f'{NS}c'):
            ref, t, v = c.get('r'), c.get('t'), c.find(f'{NS}v')
            if t == 's':
                val = shared[int(v.text)] if v is not None else ''
            elif t == 'inlineStr':
                is_ = c.find(f'{NS}is')
                val = ''.join(x.text or '' for x in is_.iter(f'{NS}t')) if is_ is not None else ''
            else:
                val = v.text if v is not None else ''
            cells[_cidx(ref)] = (val or '').strip()
        mx = max(cells) if cells else -1
        grid.append([cells.get(i, '') for i in range(mx + 1)])
    return grid


def edad_int(v):
    v = (v or "").strip()
    m = re.fullmatch(r"(\d{1,3})(\.0+)?", v)
    return int(m.group(1)) if m else None


def normalize(grid):
    # Cols: A=blank, B=Hospital, C=Nombres, D=Apellidos, E=Ced/proc, F=Edad, G=Area, H=Otra
    out = []
    for r in grid:
        pad = r + [''] * (8 - len(r)) if len(r) < 8 else r
        rec = {f: pad[i + 1] for i, f in enumerate(FIELDS)}
        if not (rec['nombres'] or rec['apellidos']):
            continue  # fila vacía
        blob = (rec['hospital'] + rec['nombres'] + rec['apellidos']).lower()
        if 'sistema de control' in blob or (rec['hospital'].lower() == 'hospital'
                                            and rec['nombres'].lower() == 'nombres'):
            continue  # título / header
        raw = rec['edad']
        ei = edad_int(raw)
        if ei is None and raw.strip():
            rec['edad_raw'] = raw  # valor mal ubicado, preservado
        rec['edad'] = ei
        rec['hospital_canon'] = CANON.get(rec['hospital'].lower().strip(), rec['hospital'].strip())
        out.append(rec)
    return out


def selftest():
    # xlsx mínimo en memoria: header + 2 filas (una con edad mal ubicada).
    import io
    ss = ('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
          '<si><t>Hospital</t></si><si><t>Nombres</t></si><si><t>Apellidos</t></si>'
          '<si><t>Domingo Luciani</t></si><si><t>lucy</t></si><si><t>castillo</t></si>'
          '<si><t>48.0</t></si><si><t>piso 2</t></si><si><t>jose</t></si><si><t>perez</t></si>')
    ss += '</sst>'
    def row(n, cells):
        cs = ''.join(f'<c r="{col}{n}" t="s"><v>{i}</v></c>' for col, i in cells)
        return f'<row r="{n}">{cs}</row>'
    sheet = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
             + row(1, [('B', 0), ('C', 1), ('D', 2)])              # header
             + row(2, [('B', 3), ('C', 4), ('D', 5), ('F', 6)])    # lucy castillo edad 48.0
             + row(3, [('B', 3), ('C', 8), ('D', 9), ('F', 7)])    # jose perez edad="piso 2"
             + '</sheetData></worksheet>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('xl/sharedStrings.xml', ss)
        z.writestr('xl/worksheets/sheet1.xml', sheet)
    buf.seek(0)
    recs = normalize(read_grid(buf))
    assert len(recs) == 2, recs
    assert recs[0]['edad'] == 48 and recs[0]['hospital_canon'] == 'Hospital Domingo Luciani', recs[0]
    assert recs[1]['edad'] is None and recs[1]['edad_raw'] == 'piso 2', recs[1]
    print("selftest ok")


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == '--selftest':
        selftest(); sys.exit(0)
    src, out = sys.argv[1], sys.argv[2]
    recs = normalize(read_grid(src))
    json.dump({'_src': src.split('/')[-1], 'records': recs}, open(out, 'w'),
              ensure_ascii=False, indent=0)
    c = Counter(r['hospital_canon'] for r in recs)
    print(f"records={len(recs)}")
    for h, n in c.most_common():
        print(f"  {n:5d}  {h}")
