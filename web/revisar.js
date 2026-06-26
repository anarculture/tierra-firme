/* Panel de revisión (operador). Carga borradores → editar/aprobar → publicar a sitreps.json.
   Sirve desde scripts/revisar-server.js (LOCAL). El público nunca ve esto. */
const root = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function card(it, i) {
  return `<div class="card draft" data-i="${i}">
    <label class="appr"><input type="checkbox" class="ap"> Aprobar y publicar</label>
    <input class="input f-tit" placeholder="Título" value="${esc(it.titulo)}">
    <input class="input f-zona" placeholder="Zona" value="${esc(it.zona)}">
    <textarea class="textarea f-texto" placeholder="Texto">${esc(it.texto)}</textarea>
    <input class="input f-fuente" placeholder="Fuente (obligatoria)" value="${esc(it.fuenteOrigen)}">
  </div>`;
}

async function publish() {
  const items = [...document.querySelectorAll(".draft")]
    .filter((c) => c.querySelector(".ap").checked)
    .map((c) => ({
      titulo: c.querySelector(".f-tit").value.trim(),
      zona: c.querySelector(".f-zona").value.trim(),
      texto: c.querySelector(".f-texto").value.trim(),
      fuenteOrigen: c.querySelector(".f-fuente").value.trim()
    }));
  const res = document.getElementById("res");
  if (!items.length) { res.textContent = "Marcá al menos un borrador como aprobado."; return; }
  if (items.some((i) => !i.fuenteOrigen)) { res.textContent = "Falta la fuente en algún aprobado (procedencia obligatoria)."; return; }
  try {
    const r = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
    const j = await r.json();
    res.textContent = r.ok ? `✓ Publicados ${j.added} (total ${j.total}). Recargando…` : `Error: ${j.error}`;
    if (r.ok) setTimeout(load, 700);
  } catch (e) { res.textContent = "Error de red: " + e.message; }
}

async function load() {
  let d = { items: [] };
  try { d = await (await fetch("/api/drafts")).json(); } catch { /* sin server */ }
  const items = d.items || [];
  if (!items.length) {
    root.innerHTML = `<div class="empty">Sin borradores. Corré <code>/sitrep</code> sobre el inbox y guardá el resultado en <code>data/sitrep-drafts.json</code> con forma <code>{"items":[…]}</code>.</div>`;
    return;
  }
  root.innerHTML = items.map(card).join("") + `<button class="btn-pub" id="pub">Publicar aprobados</button><div class="src" id="res"></div>`;
  document.getElementById("pub").onclick = publish;
}

load();
