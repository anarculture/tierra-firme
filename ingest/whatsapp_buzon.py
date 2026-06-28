#!/usr/bin/env python3
"""Buzón de WhatsApp (Meta Cloud API) para Tierra Firme — paridad con telegram_buzon.

Recibe por webhook lo que la gente manda al número de WhatsApp Business (texto, voz,
foto, video, documento) y lo vuelca crudo al inbox compartido para que /sitrep lo
destile. WhatsApp NO sondea como Telegram: entrega por POST a un HTTPS público, así
que esto es un server. Expón el puerto con `cloudflared tunnel --url http://localhost:8788`.

Uso:
  export WA_VERIFY_TOKEN=<el que pongas en la config del webhook de Meta>
  export WA_TOKEN=<token permanente de la app / system user>   # para bajar media
  export WA_APP_SECRET=<app secret>                            # valida la firma (OBLIGATORIO salvo --dev)
  python3 whatsapp_buzon.py            # corre el webhook en :8788 (exige WA_APP_SECRET)
  python3 whatsapp_buzon.py --dev      # local sin firma: acepta webhooks sin validar
  python3 whatsapp_buzon.py --selftest # prueba sin red

ponytail: intake abierto (cualquiera que escriba al número entra). Si hay spam,
filtra por wa_id. Server síncrono stdlib — el volumen de crisis no necesita async.
"""
import hashlib, hmac, json, os, re, sys, urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from inbox import INBOX, MEDIA, append  # contrato del inbox compartido
from reply import maybe_reply  # v2: responde si REPLY_ENABLED (default off)

VERIFY_TOKEN = os.environ.get("WA_VERIFY_TOKEN", "")
TOKEN = os.environ.get("WA_TOKEN", "")
APP_SECRET = os.environ.get("WA_APP_SECRET", "")
GRAPH = "https://graph.facebook.com/v21.0"
PORT = int(os.environ.get("PORT", 8788))

# tipo Meta -> (clave del objeto, extensión, kind normalizado al vocabulario de telegram)
MEDIA_KINDS = {"audio": ("audio", "ogg", "audio"), "image": ("image", "jpg", "photo"),
               "video": ("video", "mp4", "video"), "document": ("document", "bin", "document")}


def _safe(s):  # el id viene del payload (no confiable si falta firma): mata path traversal
    return "".join(c for c in str(s) if c.isalnum() or c in "-_") or "x"


def _download(media_id, dest):
    """media_id -> baja el binario (2 pasos: URL firmada de Graph, luego descarga)."""
    req = urllib.request.Request(f"{GRAPH}/{media_id}", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        url = json.load(r)["url"]
    req2 = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}",
                                                "User-Agent": "tierra-firme-buzon"})
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(req2, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())


def _sender(value, msg):
    phone = msg.get("from", "?")
    name = next((c.get("profile", {}).get("name") for c in value.get("contacts", [])
                 if c.get("wa_id") == phone), None)
    return f"{name} ({phone})" if name else phone  # phone = PII; inbox es gitignored


def parse_meta(value):
    """value (de entry[].changes[].value) -> [record {ts,from,kind,text,media}]."""
    out = []
    for msg in value.get("messages", []):
        ts = datetime.fromtimestamp(int(msg.get("timestamp", 0)), tz=timezone.utc).isoformat()
        rec = {"ts": ts, "from": _sender(value, msg), "kind": "text", "text": None, "media": None}
        mtype = msg.get("type", "text")
        if mtype == "text":
            rec["text"] = msg.get("text", {}).get("body")
        elif mtype in MEDIA_KINDS:
            obj_key, ext, kind = MEDIA_KINDS[mtype]
            obj = msg.get(obj_key, {})
            rec["kind"] = "voice" if (mtype == "audio" and obj.get("voice")) else kind
            rec["text"] = obj.get("caption")
            if obj.get("id"):
                dest = os.path.join(MEDIA, f"{_safe(obj['id'])}.{ext}")
                rec["media"] = os.path.relpath(dest, INBOX)
                if TOKEN:
                    _download(obj["id"], dest)
        else:
            rec["kind"] = mtype  # location, contacts, etc. — sin texto/media
        out.append(rec)
    return out


def _valid_sig(body, header):
    expected = "sha256=" + hmac.new(APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # handshake de suscripción de Meta
        q = parse_qs(urlparse(self.path).query)
        if VERIFY_TOKEN and q.get("hub.verify_token", [""])[0] == VERIFY_TOKEN:
            self._send(200, q.get("hub.challenge", [""])[0])
        else:
            self._send(403, "forbidden")

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if APP_SECRET and not _valid_sig(body, self.headers.get("X-Hub-Signature-256", "")):
            return self._send(403, "bad signature")
        self._send(200, "EVENT_RECEIVED")  # responde primero: evita reintentos de Meta por timeout de descarga
        try:
            data = json.loads(body or b"{}")
            for entry in data.get("entry", []):
                for change in entry.get("changes", []):
                    for rec in parse_meta(change.get("value", {})):
                        append(rec)
                        print(f"  + {rec['ts'][11:16]} {rec['from']}: {rec['kind']} {(rec['text'] or '')[:50]}")
                        # from = "Nombre (telefono)" | "telefono"; el paréntesis es el wa_id exacto
                        m = re.search(r"\((\d{6,})\)", rec["from"] or "") or re.fullmatch(r"\d{6,}", rec["from"] or "")
                        if m:
                            audio = os.path.join(INBOX, rec["media"]) if rec["media"] and rec["kind"] in ("voice", "audio") else None
                            maybe_reply(rec["text"], "whatsapp", m.group(1) if m.groups() else m.group(0), audio)
        except Exception as e:  # ponytail: descarga síncrona; si Meta reintentó, puede duplicar línea — dedup luego
            print("error procesando webhook:", e)

    def _send(self, code, body):
        self.send_response(code)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *a):  # silencia el log por-request de http.server
        pass


def run():
    dev = "--dev" in sys.argv  # firma off solo si el operador lo pide explícito
    if not VERIFY_TOKEN:
        sys.exit("Falta WA_VERIFY_TOKEN (debe coincidir con la config del webhook de Meta).")
    if not APP_SECRET and not dev:
        sys.exit("Falta WA_APP_SECRET: sin firma cualquiera con la URL del túnel inyecta al inbox. "
                 "Seteá el app secret de Meta, o corré con --dev para aceptar sin validar (solo local).")
    print(f"Webhook WhatsApp en http://localhost:{PORT}  -> {INBOX}  (Ctrl+C para parar)")
    if not TOKEN:
        print("  (sin WA_TOKEN: no baja media; solo texto/captions)")
    if not APP_SECRET:
        print("  ⚠ --dev sin WA_APP_SECRET: NO se valida la firma — cualquiera con la URL puede inyectar. Solo local.")
    # threading: la descarga de media no bloquea el siguiente webhook (append es 1 write, atómico)
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()


def selftest():
    global INBOX, MEDIA, APP_SECRET
    import tempfile
    INBOX = tempfile.mkdtemp()
    MEDIA = os.path.join(INBOX, "media")
    value = {"contacts": [{"wa_id": "584141234567", "profile": {"name": "Adi"}}],
             "messages": [
                 {"from": "584141234567", "timestamp": "1782000000", "type": "text",
                  "text": {"body": "necesitamos tapabocas en Perlamar"}},
                 {"from": "584141234567", "timestamp": "1782000050", "type": "audio",
                  "audio": {"id": "MEDIA123", "voice": True, "mime_type": "audio/ogg"}}]}
    recs = parse_meta(value)
    assert recs[0]["from"] == "Adi (584141234567)", recs[0]["from"]
    assert recs[0]["kind"] == "text" and "tapabocas" in recs[0]["text"]
    assert recs[1]["kind"] == "voice", recs[1]["kind"]
    assert recs[1]["media"] == "media/MEDIA123.ogg", recs[1]["media"]
    for r in recs:
        append(r, INBOX)
    line = open(os.path.join(INBOX, f"{recs[0]['ts'][:10]}.jsonl")).read()
    assert "tapabocas" in line, line
    # path traversal: un id malicioso queda confinado a media/
    evil = parse_meta({"messages": [{"from": "x", "timestamp": "1782000000", "type": "image",
                                     "image": {"id": "../../../../etc/passwd"}}]})
    assert evil[0]["media"] == "media/etcpasswd.jpg", evil[0]["media"]
    # firma (security path): HMAC correcto valida, incorrecto no
    APP_SECRET = "s3cr3t"
    b = b'{"x":1}'
    assert _valid_sig(b, "sha256=" + hmac.new(b"s3cr3t", b, hashlib.sha256).hexdigest())
    assert not _valid_sig(b, "sha256=deadbeef")
    print("selftest OK ->", INBOX)


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run()
