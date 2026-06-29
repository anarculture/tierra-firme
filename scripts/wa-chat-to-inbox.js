/* Adapter: export de WhatsApp (_chat.txt) → inbox JSONL.
   Convierte un export de chat de WhatsApp al MISMO contrato que escriben los buzones
   (ingest/inbox.py / whatsapp_buzon.py / telegram_buzon.py): una línea JSONL por mensaje
   {ts,from,kind,text,media} en ingest/inbox/<YYYY-MM-DD>.jsonl. Sirve para dogfood: correr
   destila.js / analiza.js sobre un chat real sin levantar el webhook.

   Une líneas de continuación al mensaje previo, salta avisos de sistema (cifrado, "X añadió
   a Y", "se unió", "fijó un mensaje", "Se eliminó este mensaje", cambios de grupo), quita el
   marcador inline "<Se editó este mensaje.>", y clasifica adjuntos en kind=image|voice|video|doc.
   Los pines de Ubicación llevan marca de sistema (LRM) pero SON contenido → se conservan como texto.

   ponytail: parser de texto, sin OCR ni transcripción. La señal que vive en fotos y notas de voz
   (listas de insumos fotografiadas, ubicaciones dictadas) queda como record media-only — el inbox
   la registra, pero destila/analiza (text-only) no la ven hasta que corra transcribe.py / OCR.

   Uso:  node scripts/wa-chat-to-inbox.js <export.txt> [--out-dir <dir>] [--day YYYY-MM-DD ...] [--dry]
         node scripts/wa-chat-to-inbox.js --selftest        (lógica pura, sin archivos) */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert";

const LRM = "‎"; // LEFT-TO-RIGHT MARK: WhatsApp lo antepone a avisos de sistema y adjuntos.
const SP = "[ \\u202f\\u00a0]"; // el timestamp de iOS usa U+202F (narrow no-break) entre hora y a./p. m.
// [D/M/YY, H:MM:SS a./p. m.] Remitente: cuerpo   (cuerpo puede ser multilínea vía continuaciones)
const HEADER = new RegExp(
  `^${LRM}?\\[(\\d{1,2})/(\\d{1,2})/(\\d{2}),${SP}+(\\d{1,2}):(\\d{2}):(\\d{2})${SP}*([ap])\\.${SP}*m\\.\\]${SP}([^:]+?):${SP}([\\s\\S]*)$`,
);
const EDIT = new RegExp(`${LRM}?<Se editó este mensaje\\.>`, "g");
const ADJUNTO = /<adjunto:\s*([^>]+?)>/;

const pad = (n) => String(n).padStart(2, "0");

/** Header → ISO local naïve (YYYY-MM-DDTHH:MM:SS). a./p. m. → 24h. Año YY → 20YY. */
export function toIso(m) {
  let h = +m.hh % 12; // 12→0, 1..11 igual
  if (m.ap === "p") h += 12; // 12pm→12, 1..11pm→+12
  return `${2000 + +m.y}-${pad(+m.mo)}-${pad(+m.d)}T${pad(h)}:${m.mm}:${m.ss}`;
}

/** kind por nombre de archivo del adjunto. */
export function kindOf(fname) {
  const f = String(fname).toLowerCase();
  if (/audio|\.opus|\.ogg|\.mp3|\.m4a|\.aac|\.wav/.test(f)) return "voice";
  if (/photo|\.jpe?g|\.png|\.webp|\.heic|\.gif/.test(f)) return "image";
  if (/video|\.mp4|\.mov|\.3gp|\.mkv/.test(f)) return "video";
  return "doc"; // vcf (contacto), pdf, docx, etc.
}

/** Texto crudo del export → mensajes {d,mo,y,hh,mm,ss,ap,sender,body}, uniendo continuaciones. */
export function parseChat(text) {
  const msgs = [];
  let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(HEADER);
    if (m) {
      if (cur) msgs.push(cur);
      cur = { d: m[1], mo: m[2], y: m[3], hh: m[4], mm: m[5], ss: m[6], ap: m[7], sender: m[8], body: m[9] };
    } else if (cur) {
      cur.body += "\n" + line; // línea de continuación del mensaje previo
    } // sin `cur`: preámbulo antes del primer header → se ignora
  }
  if (cur) msgs.push(cur);
  return msgs;
}

/** Mensaje → record del inbox, o null si es aviso de sistema / borrado / vacío. */
export function toRecord(msg) {
  const ts = toIso(msg);
  const from = msg.sender.replace(/^~\s*/, "").trim(); // "~ " marca no-contacto, no es parte del nombre
  const body = msg.body.replace(EDIT, ""); // quita marcador de edición inline
  const clean = (s) => s.replace(/‎/g, "").trim(); // sin LRM, conserva saltos internos

  const adj = body.match(ADJUNTO);
  if (adj) return { ts, from, kind: kindOf(adj[1]), text: clean(body.replace(adj[0], "")), media: adj[1].trim() };

  const stripped = clean(body);
  const low = stripped.toLowerCase();
  if (low === "audio omitido") return { ts, from, kind: "voice", text: "", media: "" };
  if (low === "imagen omitida") return { ts, from, kind: "image", text: "", media: "" };
  if (low === "video omitido") return { ts, from, kind: "video", text: "", media: "" };
  if (low === "sticker omitido" || low === "gif omitido") return { ts, from, kind: "image", text: "", media: "" };
  if (low === "documento omitido") return { ts, from, kind: "doc", text: "", media: "" };

  // Pin de ubicación: WhatsApp lo marca con LRM como si fuera de sistema, pero es contenido real.
  if (/^ubicaci[oó]n:/i.test(stripped)) return { ts, from, kind: "text", text: stripped, media: "" };
  // Aviso de sistema: el cuerpo arranca con LRM (cifrado, añadió, se unió, fijó, eliminado…).
  if (body.startsWith(LRM)) return null;
  if (!stripped) return null; // mensaje borrado sin marcador / cuerpo vacío
  return { ts, from, kind: "text", text: stripped, media: "" };
}

async function main(args) {
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) { console.error("uso: node scripts/wa-chat-to-inbox.js <export.txt> [--out-dir <dir>] [--day YYYY-MM-DD ...] [--dry]"); process.exit(1); }
  const outDir = (() => {
    const i = args.indexOf("--out-dir");
    return i >= 0 && args[i + 1] ? args[i + 1] : fileURLToPath(new URL("../ingest/inbox", import.meta.url));
  })();
  const only = new Set(args.reduce((a, v, i) => (v === "--day" && args[i + 1] ? [...a, args[i + 1]] : a), []));
  const dry = args.includes("--dry");

  const text = await readFile(file, "utf8");
  const records = parseChat(text).map(toRecord).filter(Boolean);
  const byDay = new Map();
  for (const r of records) {
    const day = r.ts.slice(0, 10);
    if (only.size && !only.has(day)) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }
  for (const [day, recs] of [...byDay].sort()) {
    recs.sort((a, b) => a.ts.localeCompare(b.ts));
    const out = recs.map((r) => JSON.stringify(r)).join("\n") + "\n";
    const path = join(outDir, `${day}.jsonl`);
    if (!dry) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, out); }
    const withText = recs.filter((r) => r.text.trim()).length;
    console.log(`${day}: ${recs.length} records · ${withText} con texto · ${recs.length - withText} media-only → ${dry ? "(dry)" : path}`);
  }
}

function selftest() {
  // toIso: a./p. m. → 24h, año YY → 20YY
  assert.equal(toIso({ d: "8", mo: "6", y: "26", hh: "4", mm: "58", ss: "32", ap: "p" }), "2026-06-08T16:58:32");
  assert.equal(toIso({ d: "28", mo: "6", y: "26", hh: "12", mm: "10", ss: "57", ap: "p" }), "2026-06-28T12:10:57", "12 p.m. → 12h");
  assert.equal(toIso({ d: "1", mo: "1", y: "26", hh: "12", mm: "05", ss: "00", ap: "a" }), "2026-01-01T00:05:00", "12 a.m. → 00h");

  assert.equal(kindOf("00005-AUDIO-2026-06-27-09-23-57.opus"), "voice");
  assert.equal(kindOf("00005-PHOTO-2026-06-28.jpg"), "image");
  assert.equal(kindOf("00005-VIDEO-2026-06-28.mp4"), "video");
  assert.equal(kindOf("00003013-Dairo Mujica y 1 contacto más.vcf"), "doc");

  // parseChat: header con U+202F en el timestamp + continuación multilínea
  const msgs = parseChat(
    "[28/6/26, 1:48:30 p. m.] Emilio Pittier: *INSUMOS NECESARIOS EN EL HOSPITAL DE CATIA*\n" +
    "• Gasas\n• Guantes\n" +
    "[28/6/26, 1:49:20 p. m.] Augusto Gerardi: ‎Se eliminó este mensaje.\n" +
    "‎[28/6/26, 1:40:06 p. m.] Manuela: ‎<adjunto: 00003013-foto.jpg>\n",
  );
  assert.equal(msgs.length, 3, "tres mensajes (header inicial opcional con LRM cuenta)");
  const insumos = toRecord(msgs[0]);
  assert.equal(insumos.kind, "text");
  assert.ok(insumos.text.includes("INSUMOS") && insumos.text.includes("Gasas") && insumos.text.includes("Guantes"), "une continuaciones");
  assert.equal(toRecord(msgs[1]), null, "aviso de sistema / borrado → null");
  const foto = toRecord(msgs[2]);
  assert.equal(foto.kind, "image");
  assert.equal(foto.media, "00003013-foto.jpg");
  assert.equal(foto.text, "", "adjunto sin caption → text vacío");

  // marcador de edición inline se quita; "~ " del remitente se normaliza
  const ed = toRecord(parseChat("[28/6/26, 4:58:32 p. m.] ~ Rodrigo Ara: Llevar al parque del este ‎<Se editó este mensaje.>\n")[0]);
  assert.equal(ed.from, "Rodrigo Ara");
  assert.equal(ed.text, "Llevar al parque del este", "quita marcador de edición");

  // pin de ubicación (LRM-prefijado) se conserva como texto
  const ubi = toRecord(parseChat("[28/6/26, 2:00:00 p. m.] Manuela: ‎Ubicación: https://maps.google.com/?q=10.5,-66.8\n")[0]);
  assert.equal(ubi.kind, "text");
  assert.ok(ubi.text.startsWith("Ubicación: https"), "conserva el pin de ubicación");

  // adjunto con archivo omitido (sin nombre)
  assert.deepEqual(
    toRecord(parseChat("[28/6/26, 2:00:00 p. m.] Ana: ‎audio omitido\n")[0]),
    { ts: "2026-06-28T14:00:00", from: "Ana", kind: "voice", text: "", media: "" },
  );
  console.log("selftest OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest();
  else main(process.argv.slice(2)).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
