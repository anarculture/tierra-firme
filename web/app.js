/* SPA monitorVE — hash router, dark minimalist editorial (ADR 0002).
   Lee de /api/* (web/api.js). Escritura (resolución) = Supabase (S10). */
import { get } from "./api.js";

const PILARES = [
  { id: "panel", t: "Panel vital", d: "Contactos de urgencia", ready: true },
  { id: "personas", t: "Personas", d: "Buscar desaparecidos / localizados", slice: "S8" },
  { id: "directorio", t: "Centros y donaciones", d: "Dónde ayudar y a dónde donar", slice: "S4" },
  { id: "mapa", t: "Mapa del país", d: "Daños y centros por estado", slice: "S2" },
  { id: "servicios", t: "Servicios", d: "Telemedicina, apoyo, estructural", slice: "S7" },
  { id: "tablero", t: "Tablero", d: "Cifras y réplicas", ready: true }
];

const PATHS = {
  back: "M15 18l-6-6 6-6",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L9 10.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z",
  chevron: "M9 18l6-6-6-6"
};
const ico = (n) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[n]}"/></svg>`;
const dial = (s) => "tel:" + String(s).replace(/[^0-9*#+]/g, "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtFecha = (iso) => { const d = new Date(iso); return isNaN(d) ? esc(iso) : `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`; };

const root = () => document.getElementById("app");

function shell(title, body, opts = {}) {
  return `
    <header class="hd">
      ${opts.back ? `<a class="back" href="#/" aria-label="Volver">${ico("back")}</a>` : ""}
      <div><h1>${esc(title)}</h1>${opts.sub ? `<p>${esc(opts.sub)}</p>` : ""}</div>
    </header>
    <main class="screen">${body}</main>
    <footer class="ft">monitorVE · iniciativa comunitaria, <b>no oficial</b>. Verificá por tus medios.</footer>`;
}

const screens = {
  home() {
    const cards = PILARES.map((p) => `
      <a class="card" href="#/${p.id}">
        <div><b>${esc(p.t)}</b><small>${esc(p.d)}</small></div>
        <span class="go">${p.ready ? ico("chevron") : `<i class="soon">${p.slice}</i>`}</span>
      </a>`).join("");
    return shell("monitorVE", `
      <p class="lede">Índice de la crisis sísmica · 24-jun-2026.</p>
      <div class="grid">${cards}</div>`, { sub: "¿Qué necesitás?" });
  },

  async panel() {
    let items = [];
    try { items = (await get("/api/panel-vital")).items || []; } catch { /* offline → lista vacía */ }
    const rows = items.map((it) => `
      <a class="row" href="${dial(it.contacto)}">
        <span class="row-ic">${ico("phone")}</span>
        <span class="row-main"><b>${esc(it.titulo)}</b><span class="num">${esc(it.contacto)}</span></span>
        <span class="src">${esc(it.fuenteOrigen)} · verificado ${fmtFecha(it.verificadoEl)}</span>
      </a>`).join("");
    return shell("Panel vital", `
      <p class="lede">Tocá para llamar. Líneas de emergencia.</p>
      <div class="list">${rows || `<div class="empty">Sin contactos cargados.</div>`}</div>`,
      { back: true, sub: "Contactos de urgencia" });
  },

  async tablero() {
    let rep = { items: [], source: "", fetchedAt: null };
    let oaf = { items: [] };
    try { rep = await get("/api/replicas"); } catch { /* offline */ }
    try { oaf = await get("/api/replicas-oaf"); } catch { /* offline */ }
    const items = rep.items || [];
    const last = items.slice(0, 8).map((r) => `
      <div class="qrow"><span class="qmag">M${esc(r.payload?.mag ?? "?")}</span><span class="qplace">${esc(r.payload?.place || "—")}</span></div>`).join("");
    const oafRows = (oaf.items || []).map((o) => `<div class="kv"><span>${esc(o.titulo)}</span><b>${esc(o.valor)}</b></div>`).join("");
    return shell("Tablero", `
      <div class="metric-card">
        <div class="metric">${items.length}</div>
        <div class="metric-lab">réplicas en la ventana${rep.source ? ` · ${esc(rep.source)}` : ""}</div>
        ${rep.fetchedAt ? `<div class="src">actualizado ${fmtFecha(rep.fetchedAt)}</div>` : ""}
      </div>
      ${oafRows ? `<div class="section">Pronóstico (USGS OAF)</div><div class="card kvs">${oafRows}</div>` : ""}
      ${items.length ? `<div class="section">Últimas réplicas</div><div class="card">${last}</div>`
        : `<div class="empty">Sin réplicas en la ventana, o la fuente no está disponible ahora.</div>`}`,
      { back: true, sub: "Cifras y réplicas" });
  },

  soon(p) {
    return shell(p.t, `<div class="empty">${esc(p.d)}.<br><span class="soon-lg">En construcción · ${p.slice}</span></div>`, { back: true });
  }
};

async function render() {
  const id = location.hash.replace(/^#\/?/, "") || "home";
  if (id === "home") return void (root().innerHTML = screens.home());
  if (screens[id]) return void (root().innerHTML = await screens[id]());
  const p = PILARES.find((x) => x.id === id);
  root().innerHTML = p ? screens.soon(p) : screens.home();
}

window.addEventListener("hashchange", render);
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
