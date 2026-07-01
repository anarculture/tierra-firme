/* Conector: libro interno → lista pública RECORTADA (site/needs.json).
   Reemplaza el conector viejo (analiza.js → needs.json sin recorte ni filtro de estado).
   Recorta a {zona, insumo, urgencia} de solo las necesidades `vigente` (ADR 0005/0006):
   allowlist deny-by-default + anti-bullwhip. La compuerta humana real vive en el panel
   `revisar` (botón Publicar lista); este CLI es el mismo recorte para el skill de deploy (#11).

   Uso:  node scripts/publica.js            # libro → site/needs.json
         node scripts/publica.js --selftest # recorte puro, sin archivos */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import { loadLibro, emptyLibro, ingestNecesidad, ingestCompra } from "../src/libro.js";
import { listaPublica } from "../src/lista-publica.js";

const NEEDS = fileURLToPath(new URL("../site/needs.json", import.meta.url));

async function main() {
  const libro = await loadLibro();
  const lista = listaPublica(libro, { fecha: new Date().toISOString().slice(0, 10) });
  await writeFile(NEEDS, JSON.stringify(lista, null, 2) + "\n");
  console.log(`publicadas ${lista.necesidades.length} necesidad(es) vigente(s) → site/needs.json`);
}

function selftest() {
  const l = emptyLibro();
  const vig = ingestNecesidad(l, { destino: { nombre: "Hospital X", tipo: "hospital", zona: "Caracas" }, insumo: "gasas", urgencia: "alta" }).necesidad;
  const comp = ingestNecesidad(l, { destino: { nombre: "Hospital Y", tipo: "hospital", zona: "La Guaira" }, insumo: "agua", urgencia: "media" }).necesidad;
  ingestCompra(l, { items: [{ insumo: "agua", cantidad: 1, costo_unitario: 1 }], necesidad_id: comp.id }); // comprada → fuera
  const lista = listaPublica(l);
  assert.equal(lista.necesidades.length, 1, "solo la vigente sale");
  assert.deepEqual(Object.keys(lista.necesidades[0]).sort(), ["insumo", "urgencia", "zona"], "recorte a 3 campos");
  assert.ok(!JSON.stringify(lista).includes("Hospital X"), "nombre de lugar NO va a la salida pública");
  void vig;
  console.log("selftest OK");
}

if (process.argv.includes("--selftest")) selftest();
else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
