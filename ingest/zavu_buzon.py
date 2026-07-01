#!/usr/bin/env python3
"""Buzón de Zavu (API multicanal) — el intake + saliente de WhatsApp de Tierra Firme.

Zavu (docs.zavu.dev) unifica WhatsApp/SMS/Telegram/Email tras una sola API, en vez
de hablar con Meta directo. Su webhook entrega los mensajes entrantes (evento
`message.inbound`) por POST a un HTTPS público; esto los vuelca crudos al inbox
compartido para que /sitrep los destile. Es un server, no un sondeo. Expón el
puerto con `cloudflared tunnel --url http://localhost:8789`.

Config del webhook: dashboard.zavu.dev -> Sender -> Webhook (o al crear el sender:
webhookUrl + webhookEvents=["message.inbound"]). Guarda el `secret` (whsec_...).

Uso:
  export ZAVU_WEBHOOK_SECRET=whsec_...   # firma HMAC del webhook (OBLIGATORIO salvo --dev)
  export ZAVU_API_KEY=zv_...             # baja media (resuelve mediaId->url) y responde
  python3 zavu_buzon.py            # webhook en :8789 (exige ZAVU_WEBHOOK_SECRET)
  python3 zavu_buzon.py --dev      # local sin firma
  python3 zavu_buzon.py --selftest # prueba sin red

ponytail: intake abierto (cualquiera que escriba al número entra). Server síncrono
stdlib; el volumen de crisis no necesita async. No usa el SDK @zavudev — urllib
stdlib, igual que los otros buzones (regla dura del repo: sin deps).
"""
import hashlib, hmac, json, os, sys, time, urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from inbox import INBOX, MEDIA, append  # contrato del inbox compartido
from reply import maybe_reply  # v2: responde si REPLY_ENABLED (default off)

SECRET = os.environ.get("ZAVU_WEBHOOK_SECRET", "")
API_KEY = os.environ.get("ZAVU_API_KEY", "")
API = os.environ.get("ZAVU_API", "https://api.zavu.dev")
PORT = int(os.environ.get("PORT", 8789))
MAX_SKEW = 300  # rechaza firmas > 5 min (anti-replay), igual que el ejemplo de Zavu

# messageType de Zavu con archivo -> kind normalizado (vocabulario telegram/whatsapp)
MEDIA_KINDS = {"image": "photo", "video": "video", "audio": "voice",
               "document": "document", "sticker": "sticker"}


def _safe(s):  # id del payload: mata path traversal
    return "".join(c for c in str(s) if c.isalnum() or c in "-_") or "x"


def _ext(mime):
    sub = (mime or "").split("/")[-1].split(";")[0].strip().lower()
    return {"jpeg": "jpg", "mpeg": "mp3", "plain": "txt"}.get(sub, sub or "bin")


def _resolve_media(message_id):
    """El webhook trae mediaId; la URL permanente aparece cuando Zavu terminó de
    guardar el archivo. Relee el mensaje buscando content.mediaUrl.
    ponytail: 3 intentos/1s; si Zavu tarda más, se pierde el archivo — dedup luego."""
    if not (message_id and API_KEY):
        return None
    req = urllib.request.Request(f"{API}/v1/messages/{message_id}",
                                 headers={"Authorization": f"Bearer {API_KEY}"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                url = (json.load(r).get("message", {}).get("content") or {}).get("mediaUrl")
            if url:
                return url
        except Exception:
            pass
        time.sleep(1)
    return None


def _download(url, dest):
    hdr = {"User-Agent": "tierra-firme-buzon"}
    if API_KEY:
        hdr["Authorization"] = f"Bearer {API_KEY}"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=hdr), timeout=60) as r, \
            open(dest, "wb") as f:
        f.write(r.read())


def _sender(d):
    phone = d.get("from", "?")
    name = d.get("profileName")
    return f"{name} ({phone})" if name else phone  # phone = PII; inbox es gitignored


def parse_event(ev):
    """evento Zavu -> [record {ts,from,kind,text,media}]. Solo message.inbound;
    ignora entregas/salientes/conversation.new (esta duplica el inbound)."""
    if ev.get("type") != "message.inbound":
        return []
    d = ev.get("data", {})
    epoch = d.get("providerTimestamp") or ev.get("timestamp") or 0  # Zavu = ms
    ts = datetime.fromtimestamp(int(epoch) / 1000, tz=timezone.utc).isoformat()
    rec = {"ts": ts, "from": _sender(d), "kind": "text",
           "text": (d.get("text") or None), "media": None}
    mt = d.get("messageType", "text")
    c = d.get("content") or {}
    if mt == "text":
        pass
    elif mt in MEDIA_KINDS:
        rec["kind"] = MEDIA_KINDS[mt]
        url = c.get("mediaUrl") or _resolve_media(d.get("messageId"))
        if url:
            mid = c.get("mediaId") or d.get("messageId") or "x"
            dest = os.path.join(MEDIA, f"{_safe(mid)}.{_ext(c.get('mimeType'))}")
            rec["media"] = os.path.relpath(dest, INBOX)
            _download(url, dest)
    elif mt == "location":
        rec["kind"] = "location"
        if not rec["text"]:  # sin coords no hay archivo: guárdalas como texto
            rec["text"] = ", ".join(str(x) for x in [c.get("name"), c.get("address"),
                                    f"{c.get('latitude')},{c.get('longitude')}"] if x)
    else:
        rec["kind"] = mt  # contact, unsupported, etc. — sin texto/media
    return [rec]


def _valid_sig(body, header):
    """X-Zavu-Signature: t=<epoch_s>,v1=<hmac>. Firma = HMAC-SHA256(secret, f"{t}.{body}")."""
    try:
        parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
        t, v1 = int(parts["t"]), parts["v1"]
    except (KeyError, ValueError):
        return False
    if abs(int(time.time()) - t) > MAX_SKEW:  # anti-replay
        return False
    expected = hmac.new(SECRET.encode(), (str(t) + ".").encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if SECRET and not _valid_sig(body, self.headers.get("X-Zavu-Signature", "")):
            return self._send(401, "bad signature")
        self._send(200, "OK")  # ack primero: evita reintentos de Zavu por timeout de descarga
        try:
            ev = json.loads(body or b"{}")
            for rec in parse_event(ev):
                append(rec)
                print(f"  + {rec['ts'][11:16]} {rec['from']}: {rec['kind']} {(rec['text'] or '')[:50]}")
                phone = ev.get("data", {}).get("from")  # E.164 directo: sin regex, es el dest exacto
                if phone:
                    audio = os.path.join(INBOX, rec["media"]) if rec["media"] and rec["kind"] == "voice" else None
                    image = os.path.join(INBOX, rec["media"]) if rec["media"] and rec["kind"] == "photo" else None
                    maybe_reply(rec["text"], "zavu", phone, audio, image)
        except Exception as e:  # ponytail: descarga síncrona; si Zavu reintentó, dedup luego
            print("error procesando webhook:", e)

    def _send(self, code, body):
        self.send_response(code)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *a):  # silencia el log por-request de http.server
        pass


def run():
    dev = "--dev" in sys.argv  # firma off solo si el operador lo pide explícito
    if not SECRET and not dev:
        sys.exit("Falta ZAVU_WEBHOOK_SECRET: sin firma cualquiera con la URL del túnel "
                 "inyecta al inbox. Toma el secret del sender (whsec_...) o corre con --dev (solo local).")
    print(f"Webhook Zavu en http://localhost:{PORT}  -> {INBOX}  (Ctrl+C para parar)")
    if not API_KEY:
        print("  (sin ZAVU_API_KEY: no baja media ni responde; solo texto/captions)")
    if not SECRET:
        print("  ⚠ --dev sin ZAVU_WEBHOOK_SECRET: NO valida firma — cualquiera inyecta. Solo local.")
    # threading: la descarga de media no bloquea el siguiente webhook (append es 1 write, atómico)
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()


def selftest():
    global INBOX, MEDIA, SECRET
    import tempfile
    INBOX = tempfile.mkdtemp()
    MEDIA = os.path.join(INBOX, "media")
    ev = {"type": "message.inbound", "timestamp": 1782000000000,
          "data": {"messageId": "msg_1", "from": "+584141234567", "channel": "whatsapp",
                   "messageType": "text", "text": "necesitamos tapabocas en Perlamar",
                   "profileName": "Adi", "providerTimestamp": 1782000000000}}
    recs = parse_event(ev)
    assert recs[0]["from"] == "Adi (+584141234567)", recs[0]["from"]
    assert recs[0]["kind"] == "text" and "tapabocas" in recs[0]["text"]
    for r in recs:
        append(r, INBOX)
    line = open(os.path.join(INBOX, f"{recs[0]['ts'][:10]}.jsonl")).read()
    assert "tapabocas" in line, line
    # eventos no-inbound se ignoran (entregas, conversation.new, etc.)
    assert parse_event({"type": "message.delivered", "data": {}}) == []
    # location -> coordenadas al texto
    loc = parse_event({"type": "message.inbound", "timestamp": 1782000000000, "data": {
        "from": "x", "messageType": "location", "providerTimestamp": 1782000000000,
        "content": {"latitude": 10.9, "longitude": -63.8, "name": "Plaza Bolívar"}}})
    assert loc[0]["kind"] == "location" and "10.9" in loc[0]["text"], loc[0]
    assert _ext("audio/ogg") == "ogg" and _ext("image/jpeg") == "jpg"
    # path traversal en mediaId (sin red: stub _download, mediaUrl directo evita _resolve)
    globals()["_download"] = lambda url, dest: None
    evil = parse_event({"type": "message.inbound", "timestamp": 1, "data": {
        "from": "x", "messageType": "image", "providerTimestamp": 1,
        "content": {"mediaId": "../../../../etc/passwd", "mimeType": "image/jpeg",
                    "mediaUrl": "https://cdn.zavu.dev/x"}}})
    assert evil[0]["media"] == "media/etcpasswd.jpg", evil[0]["media"]
    # firma (security path): HMAC + timestamp válido pasa; mal HMAC y firma vieja no
    SECRET = "whsec_test"
    b = b'{"x":1}'
    now = int(time.time())
    good = "t=%d,v1=%s" % (now, hmac.new(b"whsec_test", ("%d." % now).encode() + b, hashlib.sha256).hexdigest())
    assert _valid_sig(b, good)
    assert not _valid_sig(b, "t=%d,v1=deadbeef" % now)
    old = now - 999
    stale = "t=%d,v1=%s" % (old, hmac.new(b"whsec_test", ("%d." % old).encode() + b, hashlib.sha256).hexdigest())
    assert not _valid_sig(b, stale)  # anti-replay
    print("selftest OK ->", INBOX)


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else run()
