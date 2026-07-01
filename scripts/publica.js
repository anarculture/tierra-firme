/* Conector: salida de analiza.js → datos del sitio público de necesidades.
   Lee data/analisis-<date>.json (lo que produce scripts/analiza.js) y escribe
   site/needs.json con SOLO los campos públicos {date, resumen, necesidades}.

   Descarta ofertas/gaps/alertas a propósito: las alertas cargan PII (cuentas y
   nombres de estafa, p.ej. caso Massieu) y NO van a una página pública. Es un
   ALLOWLIST deny-by-default: si analiza.js suma un campo nuevo, no se publica
   salvo que se agregue acá explícitamente. Mismo criterio que data/api.py.

   Uso:  node scripts/publica.js [YYYY-MM-DD]   (default: hoy)
         node scripts/publica.js --selftest      (check pura, sin archivos)

   ponytail: las necesidades se pasan tal cual — analiza.js ya las deja sin PII
   (piiScan). Este conector no re-escanea; su trabajo es descartar las SECCIONES
   que sí cargan PII, no auditar las que no. */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert";

const ROOT = new URL("..", import.meta.url);
const ANALISIS = (date) => fileURLToPath(new URL(`data/analisis-${date}.json`, ROOT));
const NEEDS = fileURLToPath(new URL("site/needs.json", ROOT));

/** Allowlist: arma la salida pública SOLO con campos seguros. Todo lo demás
 *  (ofertas/gaps/alertas) se descarta por no estar en la lista. */
export function toNeeds(analisis) {
  return {
    date: analisis.date || "",
    resumen: analisis.resumen || "",
    necesidades: Array.isArray(analisis.necesidades) ? analisis.necesidades : [],
  };
}

async function main() {
  const date = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : new Date().toISOString().slice(0, 10);
  const src = ANALISIS(date);
  if (!existsSync(src)) { console.error(`sin análisis para ${date} (${src}) — corré scripts/analiza.js primero`); process.exit(1); }
  const needs = toNeeds(JSON.parse(await readFile(src, "utf8")));
  await writeFile(NEEDS, JSON.stringify(needs, null, 2) + "\n");
  console.log(`publicado ${needs.necesidades.length} necesidad(es) → site/needs.json (de analisis-${date}.json)`);
}

function selftest() {
  const out = toNeeds({
    date: "2026-06-29",
    resumen: "ok",
    necesidades: [{ zona: "Caracas", lugar: "X", items: ["agua"], urgencia: "alta", reportes: 3 }],
    ofertas: [{ zona: "Caracas", ofrece: "transporte", reportes: 2 }],
    gaps: ["algo"],
    alertas: [{ tipo: "estafa", texto: "cuenta fulano@mail.com de Fulano Pérez", reportes: 3 }],
  });
  assert.deepEqual(Object.keys(out).sort(), ["date", "necesidades", "resumen"], "solo campos públicos en la salida");
  assert.equal(out.necesidades.length, 1, "necesidades se conservan");
  // La propiedad de seguridad: NINGÚN dato de alertas/ofertas/gaps llega al output.
  assert.ok(!JSON.stringify(out).includes("@mail.com"), "PII de alertas NO debe filtrarse al output público");
  assert.ok(!JSON.stringify(out).includes("transporte"), "ofertas NO van al output público");
  console.log("selftest OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest();
  else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
