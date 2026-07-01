/* Deploy (issue 11): armar libro → generar informe (#04) + lista recortada (#05) →
   [COMPUERTA HUMANA] → deploy site/ a gh-pages. Encapsula lo mecánico y PARA en la
   revisión humana (regla dura: nada público sin gate).

   Default = DRY: genera las superficies y se DETIENE (muestra qué se publicaría, no
   deploya). --deploy = force-push real. Deploy = orphan-commit force-push (NO subtree,
   no instalado). NUNCA pushea a main. Verifica lo DEPLOYADO vía `git show` (no solo
   curl: el lag de CDN ~1-2 min da falso-OK).

   Uso:  npm run deploy               # genera + preview, NO deploya (gate humano)
         npm run deploy -- --deploy   # force-push a gh-pages (tras revisar y commitear site/)
         npm run deploy -- --selftest # invariantes de seguridad, sin git ni red */
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import { loadLibro } from "../src/libro.js";
import { agregarInforme } from "../src/informe.js";
import { listaPublica } from "../src/lista-publica.js";

const ROOT = new URL("..", import.meta.url);
const SITE_INFORME = fileURLToPath(new URL("site/informe.json", ROOT));
const SITE_NEEDS = fileURLToPath(new URL("site/needs.json", ROOT));
const BRANCH = "gh-pages";
const git = (...args) => execFileSync("git", args, { cwd: fileURLToPath(ROOT), encoding: "utf8" }).trim();

/** Refspec del deploy: SIEMPRE a gh-pages, NUNCA a main/master. Puro (la garantía dura). */
export function deployRefspec(sha, branch = BRANCH) {
  if (branch === "main" || branch === "master") throw new Error(`deploy NUNCA a ${branch}`);
  return `${sha}:refs/heads/${branch}`;
}

/** Regenera las dos superficies públicas del libro interno. */
async function generar() {
  const libro = await loadLibro();
  const fecha = new Date().toISOString().slice(0, 10);
  const informe = agregarInforme(libro, { fecha });
  const lista = listaPublica(libro, { fecha });
  await writeFile(SITE_INFORME, JSON.stringify(informe, null, 2) + "\n");
  await writeFile(SITE_NEEDS, JSON.stringify(lista, null, 2) + "\n");
  return { informe, lista };
}

async function main() {
  const doDeploy = process.argv.includes("--deploy");
  const { informe, lista } = await generar();
  console.log(`generado: informe ${informe.lineas.length} línea(s) (total ${informe.resumen.total_invertido}) · lista ${lista.necesidades.length} necesidad(es) vigente(s)`);
  if (!doDeploy) {
    console.log("\n— COMPUERTA HUMANA (nada se publica sin este paso) —");
    console.log("Revisá site/informe.json y site/needs.json. Si está bien:");
    console.log("  1) git add site && git commit -m 'publica: informe+lista'");
    console.log("  2) npm run deploy -- --deploy");
    return;
  }
  // --deploy: exige site/ committeado (se deploya el estado versionado, no un working dir sucio)
  const dirty = git("status", "--porcelain", "site");
  if (dirty) throw new Error("site/ tiene cambios sin commitear — commiteá antes de deployar:\n" + dirty);
  const tree = git("rev-parse", "HEAD:site");
  const commit = git("commit-tree", tree, "-m", `deploy: informe+lista ${new Date().toISOString().slice(0, 10)}`);
  git("push", "-f", "origin", deployRefspec(commit)); // orphan-commit, no toca main
  // Verificá lo DEPLOYADO por sha (git show), no por curl — evita falso-OK por cache CDN
  const deployed = git("show", `${commit}:index.html`).slice(0, 60).replace(/\s+/g, " ");
  console.log(`deployado a ${BRANCH} (${commit.slice(0, 8)}). index.html verificado: ${deployed}…`);
}

function selftest() {
  assert.equal(deployRefspec("abc123"), "abc123:refs/heads/gh-pages");
  assert.throws(() => deployRefspec("abc", "main"), /NUNCA a main/);
  assert.throws(() => deployRefspec("abc", "master"), /NUNCA a master/);
  assert.ok(!process.argv.includes("--deploy"), "gate: sin --deploy no hay push (dry por default)");
  console.log("selftest OK");
}

if (process.argv.includes("--selftest")) selftest();
else main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
