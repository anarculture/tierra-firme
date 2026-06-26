"""Contrato del inbox — compartido por los buzones (telegram, whatsapp).

Un record = {ts, from, kind, text, media}; una línea JSONL por mensaje en
inbox/<YYYY-MM-DD>.jsonl. La media baja a inbox/media/. inbox/ es gitignored (PII).
Fuente única para que todos los canales escriban formato idéntico — /sitrep no
distingue el canal.
"""
import json, os

INBOX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inbox")
MEDIA = os.path.join(INBOX, "media")


def append(rec, inbox=INBOX):
    """Agrega un record como línea JSONL al archivo del día. Idempotente por append."""
    os.makedirs(inbox, exist_ok=True)
    with open(os.path.join(inbox, f"{rec['ts'][:10]}.jsonl"), "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
