/* Panel del Libro interno (operador, LOCAL). Lista Necesidades con su estado DERIVADO
   y deja setear los dos estados manuales (cancelada / por_decidir) o volver a vigente.
   El estado derivado (vigente/comprada/entregada/verificada) NO se edita: sale de los
   eventos ligados (ADR 0005). Sirve desde scripts/revisar-server.js. El público no ve esto. */
const root = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DERIVADO = new Set(["vigente", "comprada", "entregada", "verificada"]);

function row(n) {
  const derivado = DERIVADO.has(n.estado);
  // El operador solo puede cancelar / poner en disputa lo derivado; o revertir un manual a vigente.
  const acts = derivado
    ? `<button data-id="${esc(n.id)}" data-e="cancelada">cancelar</button>
       <button data-id="${esc(n.id)}" data-e="por_decidir">en disputa</button>`
    : `<button data-id="${esc(n.id)}" data-e="vigente">reabrir</button>`;
  return `<div class="card nec">
    <span class="estado ${esc(n.estado)}">${esc(n.estado)}</span>
    <span class="insumo">${esc(n.insumo)}</span>
    <span class="dst">→ ${esc(n.destino?.nombre)} · ${esc(n.destino?.zona || "?")}</span>
    <span class="rep">×${n.reportes}</span>
    <span class="acts">${acts}</span>
  </div>`;
}

async function setEstado(id, estado) {
  const r = await fetch("/api/necesidad/estado", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, estado }),
  });
  if (r.ok) render(await r.json());
  else alert("Error: " + ((await r.json()).error || r.status));
}

function compraRow(c) {
  const items = (c.items || []).map((it) => `${it.cantidad}× ${esc(it.insumo)} @ ${it.costo_unitario}`).join(", ");
  return `<div class="card nec">
    <span class="estado comprada">compra${c.confirmado_por_autor ? " ✓autor" : ""}</span>
    <span class="insumo">${items}</span>
    <span class="dst">= ${c.costo_total}${c.necesidad_id ? ` · liga ${esc(c.necesidad_id)}` : " · suelta"}</span>
    ${c.quien_compro ? `<span class="rep">${esc(c.quien_compro)}</span>` : ""}
  </div>`;
}

// --- Informe de compras (issue 04): generar preview → publicar (compuerta humana) ---
async function generarInforme() {
  const box = document.getElementById("informe-box");
  const inf = await (await fetch("/api/informe")).json();
  box.innerHTML =
    `<div class="card"><b>Preview del informe</b> — ${inf.resumen.tipos} tipos · ${inf.resumen.unidades} unidades · total ${inf.resumen.total_invertido}
     <table style="width:100%;margin-top:8px;font-size:13px;border-collapse:collapse">
     <tr><th>N.º</th><th style="text-align:left">Descripción</th><th>Cant</th><th>C.unit</th><th>Total</th></tr>
     ${inf.lineas.map((l) => `<tr><td>${l.n}</td><td>${esc(l.descripcion)}</td><td>${l.cantidad}</td><td>${l.costo_unitario}</td><td>${l.costo_total}</td></tr>`).join("")}
     </table>
     <button id="pub-informe" style="margin-top:10px">Publicar informe (compuerta humana)</button>
     <span id="informe-res" class="rep"></span></div>`;
  document.getElementById("pub-informe").onclick = async () => {
    const r = await fetch("/api/informe/publicar", { method: "POST" });
    const j = await r.json();
    document.getElementById("informe-res").textContent = r.ok ? `✓ Publicado: ${j.lineas} líneas, total ${j.total} → site/informe.json` : "Error";
  };
}

function entregaRow(e) {
  const items = (e.items || []).map((it) => `${it.cantidad}× ${esc(it.insumo)}`).join(", ");
  const dst = typeof e.destino === "string" ? e.destino : e.destino?.nombre || "?";
  return `<div class="card nec">
    <span class="estado ${e.foto ? "verificada" : "entregada"}">entrega${e.foto ? " 📷" : ""}${e.confirmado_por_autor ? " ✓autor" : ""}</span>
    <span class="insumo">${items || "—"}</span>
    <span class="dst">→ ${esc(dst)}${e.necesidad_id ? ` · liga ${esc(e.necesidad_id)}` : ""}</span>
    ${e.quien_entrego ? `<span class="rep">${esc(e.quien_entrego)}</span>` : ""}
  </div>`;
}

// --- Lista pública recortada (issue 05): generar preview → publicar (compuerta humana) ---
async function generarLista() {
  const box = document.getElementById("lista-box");
  const l = await (await fetch("/api/lista")).json();
  box.innerHTML =
    `<div class="card"><b>Preview lista pública</b> — ${l.necesidades.length} necesidad(es) vigente(s), recortadas a zona+insumo+urgencia
     ${l.necesidades.map((n) => `<div class="rep">· ${esc(n.urgencia)} — ${esc(n.insumo)} (${esc(n.zona || "?")})</div>`).join("")}
     <button id="pub-lista" style="margin-top:10px">Publicar lista (compuerta humana)</button>
     <span id="lista-res" class="rep"></span></div>`;
  document.getElementById("pub-lista").onclick = async () => {
    const r = await fetch("/api/lista/publicar", { method: "POST" });
    const j = await r.json();
    document.getElementById("lista-res").textContent = r.ok ? `✓ Publicadas ${j.necesidades} → site/needs.json` : "Error";
  };
}

function render(data) {
  const { necesidades = [], compras = [], entregas = [] } = data || {};
  const toolbar = `<div class="nec">
    <button id="gen-informe">Generar informe</button><a href="/informe.html" class="dst" target="_blank">informe público →</a>
    <button id="gen-lista">Generar lista pública</button><a href="/lista.html" class="dst" target="_blank">lista pública →</a>
  </div><div id="informe-box"></div><div id="lista-box"></div>`;
  if (!necesidades.length && !compras.length && !entregas.length) {
    root.innerHTML = toolbar + `<div class="empty">Libro vacío. Ingresá con <code>node scripts/libro.js destila &lt;fecha&gt;</code> · <code>add-json</code> · <code>add-compra</code> · <code>add-entrega</code>.</div>`;
  } else {
    root.innerHTML = toolbar +
      (necesidades.length ? `<h2 class="sub">Necesidades</h2>` + necesidades.map(row).join("") : "") +
      (compras.length ? `<h2 class="sub">Compras</h2>` + compras.map(compraRow).join("") : "") +
      (entregas.length ? `<h2 class="sub">Entregas</h2>` + entregas.map(entregaRow).join("") : "");
    for (const b of root.querySelectorAll(".acts button")) b.onclick = () => setEstado(b.dataset.id, b.dataset.e);
  }
  document.getElementById("gen-informe").onclick = generarInforme;
  document.getElementById("gen-lista").onclick = generarLista;
}

(async () => {
  try { render(await (await fetch("/api/libro")).json()); }
  catch { root.innerHTML = `<div class="empty">Sin servidor. Corré <code>npm run revisar</code>.</div>`; }
})();
