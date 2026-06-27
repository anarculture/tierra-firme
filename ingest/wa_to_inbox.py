#!/usr/bin/env python3
"""Converter: export de WhatsApp (`_chat.txt`) → inbox jsonl del intake.

Las exportaciones de WhatsApp son una fuente real (la gente coordina ahí). Esto
las vuelca al MISMO contrato que los buzones (`inbox.py`): records
{ts, from, kind, text, media} agrupados por fecha en `inbox/<YYYY-MM-DD>.jsonl`,
para que destila.js / analiza.js los procesen igual que el intake en vivo.

Formato iOS: `[DD/M/YY, H:MM:SS p. m.] Remitente: texto`, con espacios finos
invisibles (U+202F), marcas LTR (U+200E), CRLF y prefijo `~ ` en no-contactos.
Mensajes de sistema (cifrado, "se unió", "creó el grupo"…) se descartan.
Adjuntos `<adjunto: archivo>` quedan como kind="media" (texto vacío → destila/
analiza text-only los saltan; el futuro multimodal los levanta por filename).

ponytail: PII (nombres) va al `from` tal cual — el dueño aceptó mandar crudo a
Gemini; el prompt limpia PII de la SALIDA. La media no se copia, solo se nombra.

Uso:  python3 wa_to_inbox.py "docs/WhatsApp Chat - X/_chat.txt" [--min 2026-06-24T18:00]
      python3 wa_to_inbox.py --selftest
"""
import json, os, re, sys, unicodedata
from datetime import datetime
from collections import defaultdict

INBOX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inbox")

# [DD/M/YY, H:MM:SS a|p. m.] Remitente: texto   (tras normalizar invisibles)
_HEADER = re.compile(
    r"^\[(\d{1,2})/(\d{1,2})/(\d{2,4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+([ap])\.\s*m\.\]\s+(.+?):\s?(.*)$"
)
_ADJUNTO = re.compile(r"<adjunto:\s*([^>]+)>")
_SISTEMA = re.compile(
    r"cifrad[oa]s de extremo a extremo|creó (este grupo|el grupo)|te añadió|añadió a|"
    r"se unió (con el enlace|usando)|cambió (la descripción|el asunto|la foto|el ícono|su número|el nombre)|"
    r"(se activaron|desactivó|activó) los mensajes temporales|se eliminó este mensaje|"
    r"eliminaste este mensaje|salió del grupo|eliminó a|ahora eres admin|"
    r"cambiaste al grupo|este chat es con un|tu código de seguridad",
    re.IGNORECASE,
)


def _norm(s):
    """Quita marcas LTR/RTL invisibles y normaliza espacios finos a normal."""
    s = s.replace("‎", "").replace("‏", "").replace("﻿", "")
    s = s.replace(" ", " ").replace(" ", " ")
    return s.replace("\r", "")


def _ts(d, mo, y, h, mi, se, ap):
    """Partes 12h → ISO 8601. Año 2 dígitos → 20YY."""
    y = int(y);  y = 2000 + y if y < 100 else y
    h = int(h) % 12 + (12 if ap == "p" else 0)
    return datetime(y, int(mo), int(d), h, int(mi), int(se)).strftime("%Y-%m-%dT%H:%M:%S")


def parse_line(line):
    """Línea con header → record parcial {ts, from, kind, text, media}. Si no
    matchea header (continuación) o es sistema, devuelve None."""
    m = _HEADER.match(line)
    if not m:
        return None
    d, mo, y, h, mi, se, ap, sender, text = m.groups()
    if _SISTEMA.search(text) or _SISTEMA.search(sender):
        return None
    sender = sender.lstrip("~ ").strip()
    media = None
    adj = _ADJUNTO.search(text)
    if adj:
        media = adj.group(1).strip()
        text = _ADJUNTO.sub("", text).strip()
    return {"ts": _ts(d, mo, y, h, mi, se, ap), "from": sender,
            "kind": "media" if (media and not text) else "text",
            "text": text, "media": media}


def parse_chat(raw):
    """Texto completo → lista de records. Une líneas de continuación al record previo."""
    recs = []
    for line in _norm(raw).split("\n"):
        rec = parse_line(line)
        if rec:
            recs.append(rec)
        elif recs and line.strip():            # continuación del mensaje anterior
            recs[-1]["text"] = (recs[-1]["text"] + "\n" + line).strip()
            if recs[-1]["text"] and recs[-1]["kind"] == "media":
                recs[-1]["kind"] = "text"
    return recs


def main(path, min_ts=None):
    with open(path, encoding="utf-8") as f:
        recs = parse_chat(f.read())
    if min_ts:
        recs = [r for r in recs if r["ts"] >= min_ts]
    by_date = defaultdict(list)
    for r in recs:
        by_date[r["ts"][:10]].append(r)
    os.makedirs(INBOX_DIR, exist_ok=True)
    for date, rs in sorted(by_date.items()):
        out = os.path.join(INBOX_DIR, f"{date}.jsonl")
        with open(out, "w", encoding="utf-8") as f:
            for r in rs:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        con_texto = sum(1 for r in rs if r["text"])
        print(f"{out}: {len(rs)} msgs ({con_texto} con texto, {len(rs)-con_texto} solo-media)")
    if not by_date:
        print("sin mensajes (¿formato distinto o todo filtrado por --min?)")


def selftest():
    raw = (
        "‎[26/6/26, 12:10:57 p. m.] 3 pasos: ‎Los mensajes están cifrados de extremo a extremo\r\n"
        "[26/6/26, 1:48:30 p. m.] Emilio Pittier: *INSUMOS NECESARIOS EN CATIA*\r\n"
        "siguen faltando gasas\r\n"
        "[26/6/26, 1:52:15 p. m.] ~ Rodrigo Ara: ‎<adjunto: 00003027-PHOTO.jpg>\r\n"
        "[26/6/26, 2:00:00 a. m.] Ana: madrugada\r\n"
    )
    recs = parse_chat(raw)
    assert len(recs) == 3, [r["text"] for r in recs]          # sistema descartado
    assert recs[0]["from"] == "Emilio Pittier"
    assert recs[0]["text"] == "*INSUMOS NECESARIOS EN CATIA*\nsiguen faltando gasas", recs[0]["text"]
    assert recs[0]["ts"] == "2026-06-26T13:48:30", recs[0]["ts"]   # p.m. → 13h
    assert recs[1]["from"] == "Rodrigo Ara" and recs[1]["kind"] == "media"   # ~ stripped, adjunto
    assert recs[1]["media"] == "00003027-PHOTO.jpg" and recs[1]["text"] == ""
    assert recs[2]["ts"] == "2026-06-26T02:00:00", recs[2]["ts"]   # a.m. → 02h
    # filtro --min descarta la madrugada
    assert [r for r in recs if r["ts"] >= "2026-06-26T12:00"] == recs[:2]
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        mt = None
        if "--min" in sys.argv:
            mt = sys.argv[sys.argv.index("--min") + 1]
        main(sys.argv[1], mt)
    else:
        sys.exit('uso: wa_to_inbox.py "<_chat.txt>" [--min 2026-06-24T18:00] | --selftest')
