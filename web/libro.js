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
  if (r.ok) render((await r.json()).necesidades);
  else alert("Error: " + ((await r.json()).error || r.status));
}

function render(necesidades) {
  if (!necesidades?.length) {
    root.innerHTML = `<div class="empty">Libro vacío. Ingresá necesidades con <code>node scripts/libro.js destila &lt;fecha&gt;</code> o <code>add-json</code>.</div>`;
    return;
  }
  root.innerHTML = necesidades.map(row).join("");
  for (const b of root.querySelectorAll("button")) b.onclick = () => setEstado(b.dataset.id, b.dataset.e);
}

(async () => {
  try { render((await (await fetch("/api/libro")).json()).necesidades); }
  catch { root.innerHTML = `<div class="empty">Sin servidor. Corré <code>npm run revisar</code>.</div>`; }
})();
