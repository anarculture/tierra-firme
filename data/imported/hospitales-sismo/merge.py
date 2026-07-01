#!/usr/bin/env python3
"""Une todas las fuentes de personas de este dir en un solo combined-records.json,
listo para dedup.py. Auto-detecta cualquier *.json con clave 'records'.

Uso:  python3 merge.py            # escribe combined-records.json
      python3 merge.py && python3 dedup.py combined-records.json personas.json

Llaves de salida por registro (las que dedup.py entiende): nombres, apellidos, cedula,
edad, sexo, hospital, area, piso_cama, procedencia, diagnostico, estado, fecha, hora,
familiar, fuente. Se copian tal cual si existen; se aplican 2 normalizaciones:
  - pacientes-control: 'ced_o_procedencia' → 'cedula' (esa hoja mezcla cédula/lugar).
  - fuente ausente → nombre del archivo.
"""
import json, os, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP = {'personas.json', 'combined-records.json'}  # salidas, no fuentes
KEYS = ['nombres', 'apellidos', 'cedula', 'edad', 'sexo', 'hospital', 'area',
        'piso_cama', 'procedencia', 'diagnostico', 'estado', 'fecha', 'hora',
        'familiar', 'fuente', 'hospital_canon', 'descripcion', 'lat', 'lng', 'ultima_vez']

merged, per_src = [], {}
for f in sorted(glob.glob(os.path.join(HERE, '*.json'))):
    if os.path.basename(f) in SKIP:
        continue
    try:
        d = json.load(open(f))
    except Exception:
        continue
    if not (isinstance(d, dict) and isinstance(d.get('records'), list)):
        continue  # busqueda-familiares (usa 'filas') y otros quedan fuera
    stem = os.path.basename(f).replace('.json', '')
    for r in d['records']:
        rec = {k: (r.get(k) or '') for k in KEYS if r.get(k) not in (None, '')}
        if 'cedula' not in rec and r.get('ced_o_procedencia'):
            rec['cedula'] = r['ced_o_procedencia']          # hoja control mezcla céd/lugar
        rec.setdefault('fuente', stem)
        merged.append(rec)
    per_src[stem] = len(d['records'])

out = os.path.join(HERE, 'combined-records.json')
json.dump({'_fuentes': per_src, 'records': merged}, open(out, 'w'), ensure_ascii=False, indent=0)
print(f"combined-records.json: {len(merged)} records de {len(per_src)} fuentes")
for s, n in sorted(per_src.items(), key=lambda x: -x[1]):
    print(f"  {n:7d}  {s}")
