#!/usr/bin/env python3
"""Buzón de Telegram para Tierra Firme — primer adaptador de ingest.

Recibe lo que la gente envía/reenvía a un bot de Telegram (texto, voz, fotos,
documentos) y lo vuelca crudo a inbox/ para que /sitrep lo destile. El dump
crudo es privado entre verificadores; solo el sitrep verificado se hace público.

Uso:
  export TELEGRAM_BOT_TOKEN=<token de @BotFather>
  python3 telegram_buzon.py            # corre el colector (long-poll)
  python3 telegram_buzon.py --selftest # prueba sin red

ponytail: intake abierto (cualquiera con el bot puede enviar). Si hay spam,
agrega un allowlist de chat_id. Long-poll, no webhook, porque corre local sin
endpoint público. Sin transcripción acá: guarda el .ogg; /sitrep lo transcribe.
"""
import json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from inbox import INBOX, MEDIA, append  # contrato del inbox compartido
from reply import maybe_reply  # v2: responde si REPLY_ENABLED (default off)

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
BASE = f"https://api.telegram.org/bot{TOKEN}"
OFFSET_FILE = os.path.join(INBOX, ".offset")


def _api(method, **params):
    url = f"{BASE}/{method}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=params.get("timeout", 30) + 10) as r:
        return json.load(r)


def _download(file_id, dest):
    info = _api("getFile", file_id=file_id)
    path = info["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{TOKEN}/{path}"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())


def _sender(msg):
    u = msg.get("from", {})
    name = u.get("first_name", "?")
    if u.get("username"):
        name += f" (@{u['username']})"
    return name  # ponytail: Telegram no expone teléfono salvo que compartan contacto


def record(msg):
    """Mensaje de Telegram -> registro crudo (+ baja media si hay). Devuelve dict."""
    ts = datetime.fromtimestamp(msg.get("date", 0), tz=timezone.utc).isoformat()
    rec = {"ts": ts, "from": _sender(msg), "kind": "text", "text": None, "media": None}
    rec["text"] = msg.get("text") or msg.get("caption")
    media_id = ext = None
    for kind, key, e in (("voice", "voice", "ogg"), ("audio", "audio", "mp3"),
                         ("photo", "photo", "jpg"), ("video", "video", "mp4"),
                         ("document", "document", "bin")):
        if key in msg:
            rec["kind"] = kind
            media_id = msg[key][-1]["file_id"] if key == "photo" else msg[key]["file_id"]
            ext = e
            break
    if media_id:
        dest = os.path.join(MEDIA, f"{msg['message_id']}.{ext}")
        rec["media"] = os.path.relpath(dest, INBOX)
        if TOKEN:
            _download(media_id, dest)
    return rec


def poll():
    if not TOKEN:
        sys.exit("Falta TELEGRAM_BOT_TOKEN (crea el bot con @BotFather).")
    offset = int(open(OFFSET_FILE).read()) if os.path.exists(OFFSET_FILE) else 0
    me = _api("getMe")["result"]["username"]
    print(f"Buzón activo: @{me} -> {INBOX}  (Ctrl+C para parar)")
    while True:
        try:
            res = _api("getUpdates", offset=offset, timeout=30)["result"]
        except Exception as e:
            print("reintento:", e)
            time.sleep(3)
            continue
        for upd in res:
            offset = upd["update_id"] + 1
            msg = upd.get("message") or upd.get("channel_post")
            if msg:
                rec = record(msg)
                append(rec)
                audio = os.path.join(INBOX, rec["media"]) if rec["media"] and rec["kind"] in ("voice", "audio") else None
                maybe_reply(rec["text"], "telegram", msg.get("chat", {}).get("id"), audio)
                snippet = (rec["text"] or "")[:50]
                print(f"  + {rec['ts'][11:16]} {rec['from']}: {rec['kind']} {snippet}")
            os.makedirs(INBOX, exist_ok=True)
            open(OFFSET_FILE, "w").write(str(offset))


def selftest():
    global INBOX, MEDIA
    import tempfile
    INBOX = tempfile.mkdtemp()
    MEDIA = os.path.join(INBOX, "media")
    fake = {"message_id": 1, "date": 1782000000,
            "from": {"first_name": "Adi", "username": "adi"},
            "text": "necesitamos tapabocas en Perlamar"}
    rec = record(fake)
    assert rec["from"] == "Adi (@adi)", rec["from"]
    assert rec["kind"] == "text" and "tapabocas" in rec["text"]
    append(rec, INBOX)  # INBOX reasignado al tempdir; pasa explícito
    line = open(os.path.join(INBOX, f"{rec['ts'][:10]}.jsonl")).read()
    assert "tapabocas" in line, line
    print("selftest OK ->", INBOX)


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else poll()
