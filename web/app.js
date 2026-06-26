/* monitorVE — consola situacional (ADR 0003). El mapa es la app. Leaflet global (L).
   Densidad sobre estética · marcadores tipados por _kind · degradación elegante (útil con cero datos). */
import { get } from "./api.js";
import { pipFeature } from "./pip.js";
import { filtrar, estadosDe } from "./centros-filter.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dial = (s) => "tel:" + String(s).replace(/[^0-9*#+]/g, "");
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function hace(iso) {
  if (!iso) return "sin datos";
  if (iso === "curado") return "curado";
  const t = new Date(iso).getTime(); if (isNaN(t)) return esc(iso);
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = new Date(iso); return `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
}
function frescura(iso) {
  if (!iso || iso === "curado") return iso === "curado" ? "fresh" : "none";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (isNaN(m)) return "none";
  return m < 60 ? "fresh" : m < 360 ? "aging" : "stale";
}
const el = (id) => document.getElementById(id);

/* Capas: cada _kind con símbolo/color propio. Capa apagada = sin fetch (worldmonitor). */
const LAYERS = [
  { key: "epicentro", label: "Epicentros", endpoint: "eventos", color: "#e5484d", sym: "★", on: true, rings: true },
  { key: "replica", label: "Réplicas", endpoint: "replicas", color: "#e0a33e", sym: "●", on: true },
  { key: "acopio", label: "Centros de acopio", endpoint: "centros", color: "#4c8dff", sym: "▣", on: false },
  { key: "refugio", label: "Refugios", endpoint: "refugios", color: "#3fb27f", sym: "⌂", on: false },
  { key: "dano", label: "Daños", endpoint: "danos", color: "#b5179e", sym: "▲", on: false },
  { key: "hospital", label: "Hospitales", endpoint: "hospitales", color: "#e6e9ef", sym: "＋", on: false }
];

const state = { map: null, groups: {}, loaded: {}, health: {} };

function initMap() {
  const map = L.map("map", { zoomControl: true }).setView([8.4, -66.4], 6);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap, © CARTO", subdomains: "abcd", maxZoom: 19
  }).addTo(map);
  state.map = map;
}

function addMarker(group, def, item) {
  const c = item.coords; if (!c || c.lat == null || c.lng == null) return false;
  const mag = item.payload?.mag;
  const isEpi = def.key === "epicentro";
  // Marcador tipado: el glifo del _kind (coincide con la leyenda), tamaño ≈ magnitud.
  const size = isEpi ? Math.max(20, (mag || 6) * 3) : Math.max(13, (mag || 4) * 2.4);
  const icon = L.divIcon({
    className: "mk",
    html: `<span style="color:${def.color};font-size:${size}px">${def.sym}</span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
  const m = L.marker([c.lat, c.lng], { icon, title: item.payload?.place || def.label });
  m.on("click", () => showDetail(def, item));
  m.addTo(group);
  if (def.rings && item.payload?.ring_km) {
    L.circle([c.lat, c.lng], { radius: item.payload.ring_km * 1000, color: def.color, weight: 1, fill: false, dashArray: "4 6", opacity: 0.5 }).addTo(group);
  }
  return true;
}

async function loadLayer(def) {
  if (state.loaded[def.key]) return state.loaded[def.key];
  let body = { items: [] };
  try { body = await get("/api/" + def.endpoint); } catch { /* offline → vacío */ }
  const items = body.items || [];
  const group = L.layerGroup();
  let plotted = 0;
  for (const it of items) if (addMarker(group, def, it)) plotted++;
  state.groups[def.key] = group;
  state.loaded[def.key] = { items, plotted, fetchedAt: body.fetchedAt || (def.endpoint === "eventos" ? "curado" : null) };
  state.health[def.key] = state.loaded[def.key];
  return state.loaded[def.key];
}

async function toggleLayer(def, on) {
  if (!on) { if (state.groups[def.key]) state.map.removeLayer(state.groups[def.key]); return null; }
  const r = await loadLayer(def);
  state.groups[def.key].addTo(state.map);
  return r;
}

async function renderKPIs() {
  let crisis = { items: [] }, oaf = { items: [] }, rep = { items: [] };
  try { crisis = await get("/api/crisis"); } catch {}
  try { oaf = await get("/api/replicas-oaf"); } catch {}
  try { rep = await get("/api/replicas"); } catch {}
  const kpis = [];
  for (const it of crisis.items || []) {
    const cls = it.k === "Fallecidos" ? "k-crit" : it.k === "Heridos" ? "k-warn" : "";
    kpis.push(`<div class="kpi" title="${esc(it.fuente)} · ${esc(it.nota || "")}"><b class="${cls}">${esc(it.v)}</b><small>${esc(it.k)}</small></div>`);
  }
  kpis.push(`<div class="kpi"><b class="k-warn">${(rep.items || []).length}</b><small>Réplicas (ventana)</small></div>`);
  for (const o of oaf.items || []) kpis.push(`<div class="kpi"><b class="k-info">${esc(o.valor)}</b><small>${esc(o.titulo)}</small></div>`);
  kpis.push(`<div class="kpi"><b>${hace(rep.fetchedAt)}</b><small>Actualizado</small></div>`);
  el("kpis").innerHTML = kpis.join("");
}

function renderLeft() {
  const rows = LAYERS.map((d) => `
    <label class="layer">
      <input type="checkbox" data-layer="${d.key}" ${d.on ? "checked" : ""}>
      <span class="sym" style="color:${d.color}">${d.sym}</span>
      <span class="lname">${esc(d.label)}</span>
      <span class="lcount" id="lc-${d.key}">—</span>
    </label>`).join("");
  el("left").innerHTML = `<h3>Capas</h3>${rows}
    <h3>Choropleth</h3>
    <label class="layer"><input type="checkbox" id="choro-on"><span class="lname">Intensidad por estado</span></label>
    <div class="lede" id="choro-scale" style="font-size:11px">Colorea estados por nº de puntos de las capas activas.</div>
    <h3>Leyenda</h3>
    <div class="lede" style="font-size:12px">Tamaño del punto ≈ magnitud. Anillo punteado = estimación de área afectada (epicentros). Cada dato lleva su fuente.</div>`;
  el("left").querySelectorAll("input[data-layer]").forEach((inp) => {
    inp.addEventListener("change", async (e) => {
      const def = LAYERS.find((x) => x.key === e.target.dataset.layer);
      const r = await toggleLayer(def, e.target.checked);
      if (r) el("lc-" + def.key).textContent = r.plotted + (r.items.length > r.plotted ? `/${r.items.length}` : "");
      renderSources();
      if (choro.on) renderChoro();
    });
  });
  el("choro-on").addEventListener("change", (e) => { choro.on = e.target.checked; renderChoro(); });
}

/* Choropleth: colorea estados por nº de puntos (de capas activas) que caen en cada polígono (PIP). */
const choro = { on: false, layer: null, geo: null };
async function ensureEstados() {
  if (!choro.geo) { const r = await fetch("ve-estados.geojson"); choro.geo = await r.json(); }
  return choro.geo;
}
function activeItems() {
  const out = [];
  for (const d of LAYERS) {
    const l = state.loaded[d.key];
    if (l && state.groups[d.key] && state.map.hasLayer(state.groups[d.key])) out.push(...l.items);
  }
  return out;
}
const normEstado = (s) => String(s || "").replace(/\s*\(.*\)\s*/g, "").trim();
function choroColor(n, max) {
  if (!n) return "#1a1f2b";
  const r = n / max;
  return r > 0.66 ? "#e5484d" : r > 0.33 ? "#e0a33e" : "#3fb27f";
}
async function renderChoro() {
  if (!choro.on) { if (choro.layer) { state.map.removeLayer(choro.layer); choro.layer = null; } return; }
  const geo = await ensureEstados();
  // Conteo por campo `estado` (centros) + PIP por coords (epicentros/réplicas/daños sin estado).
  const byName = {}; const coordPts = [];
  for (const it of activeItems()) {
    const e = normEstado(it.payload?.estado);
    if (e) byName[e] = (byName[e] || 0) + 1;
    else if (it.coords) coordPts.push([it.coords.lng, it.coords.lat]);
  }
  const counts = {};
  let max = 1;
  for (const f of geo.features) {
    let n = byName[f.properties.name] || 0;
    for (const p of coordPts) if (pipFeature(p, f.geometry)) n++;
    counts[f.properties.name] = n;
    if (n > max) max = n;
  }
  if (choro.layer) state.map.removeLayer(choro.layer);
  choro.layer = L.geoJSON(geo, {
    style: (f) => { const n = counts[f.properties.name] || 0; return { color: "#2e3850", weight: 1, fillColor: choroColor(n, max), fillOpacity: n ? 0.5 : 0.06 }; },
    onEachFeature: (f, layer) => { const n = counts[f.properties.name] || 0; layer.bindTooltip(`${f.properties.name}: ${n} punto(s)`, { sticky: true }); }
  });
  choro.layer.addTo(state.map);
  choro.layer.bringToBack();
  el("choro-scale").textContent = `Intensidad por estado (máx ${max}) · puntos de capas activas.`;
}

async function renderFeed() {
  let rep = { items: [] };
  try { rep = await get("/api/replicas"); } catch {}
  const items = (rep.items || []).slice(0, 12);
  const body = items.length
    ? items.map((r) => `<div class="feed-item"><span class="feed-mag">M${esc(r.payload?.mag ?? "?")}</span> ${esc(r.payload?.place || "—")}<div class="src">${esc(r.sourceId)} · ${hace(r.payload?.time || r.fetchedAt)}</div></div>`).join("")
    : `<div class="empty">Sin actividad sísmica en la ventana, o la fuente no está disponible ahora.</div>`;
  el("right").innerHTML = `<h3>Feed · últimas réplicas</h3>${body}`;
}

function showDetail(def, item) {
  const p = item.payload || {};
  const rows = [];
  if (p.mag != null) rows.push(["Magnitud", "M" + p.mag]);
  if (p.depth != null) rows.push(["Profundidad", p.depth + " km"]);
  if (p.place) rows.push(["Lugar", p.place]);
  if (p.time) rows.push(["Hora", p.time]);
  if (item.coords) rows.push(["Coords", `${item.coords.lat}, ${item.coords.lng}`]);
  const src = item.fuenteOrigen || item.sourceId || "—";
  el("right").innerHTML = `
    <div class="detail">
      <h4><span style="color:${def.color}">${def.sym}</span> ${esc(def.label.replace(/s$/, ""))}</h4>
      <div class="card">${rows.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>
      ${item.nota ? `<div class="src" style="margin-top:8px">${esc(item.nota)}</div>` : ""}
      <div class="src">Fuente: ${esc(src)}${item.verificadoEl ? ` · verificado ${esc(item.verificadoEl)}` : ""}</div>
      <button class="tbtn" style="margin-top:12px" id="back-feed">← Volver al feed</button>
    </div>`;
  el("back-feed").addEventListener("click", renderFeed);
  if (item.coords) state.map.panTo([item.coords.lat, item.coords.lng]);
}

function renderSources() {
  const parts = LAYERS.map((d) => {
    const h = state.health[d.key];
    let cls = "none", txt = "sin cargar";
    if (h) {
      if (h.fetchedAt === "curado") { cls = "fresh"; txt = "curado"; }
      else if (!h.items.length) { cls = "none"; txt = "sin datos"; }
      else { cls = frescura(h.fetchedAt); txt = hace(h.fetchedAt); }
    }
    return `<span class="shealth"><span class="dot ${cls}"></span>${esc(d.label)}: ${txt}</span>`;
  });
  el("sources").innerHTML = `<span class="shealth"><b>Fuentes</b></span>` + parts.join("");
}

function openSheet(title, html) {
  const ov = el("overlay");
  ov.innerHTML = `<div class="sheet"><div class="sheet-hd"><b>${esc(title)}</b><button class="x" aria-label="Cerrar">×</button></div>${html}</div>`;
  ov.hidden = false;
  ov.querySelector(".x").onclick = () => (ov.hidden = true);
  ov.onclick = (e) => { if (e.target === ov) ov.hidden = true; };
}
async function openPanelVital() {
  let items = []; try { items = (await get("/api/panel-vital")).items || []; } catch {}
  const rows = items.map((it) => `<a class="row" href="${dial(it.contacto)}"><span class="row-main"><b>${esc(it.titulo)}</b><span class="num">${esc(it.contacto)}</span></span><span class="src">${esc(it.fuenteOrigen)} · verificado ${esc(it.verificadoEl)}</span></a>`).join("");
  openSheet("Panel vital", `<div class="list">${rows || `<div class="empty">Sin contactos.</div>`}</div>`);
}
async function openServicios() {
  let items = []; try { items = (await get("/api/servicios")).items || []; } catch {}
  const rows = items.map((it) => {
    const ph = !!it.contacto; const href = ph ? dial(it.contacto) : it.link || "#"; const ext = ph ? "" : ' target="_blank" rel="noopener"';
    return `<a class="row" href="${href}"${ext}><span class="row-main"><b>${esc(it.titulo)}</b>${ph ? `<span class="num">${esc(it.contacto)}</span>` : ""}</span><span class="src">${esc(it.comoContactar)} · ${esc(it.fuenteOrigen)}</span></a>`;
  }).join("");
  openSheet("Servicios", `<div class="list">${rows || `<div class="empty">Sin servicios.</div>`}</div>`);
}

function centroRow(c) {
  const p = c.payload || {};
  const loc = [p.municipio, p.estado].filter(Boolean).join(", ");
  const needs = (p.needs || []).map((n) => (typeof n === "string" ? n : n.key)).filter(Boolean).slice(0, 4).join(" · ");
  return `<div class="row" style="grid-template-columns:1fr">
    <span class="row-main"><b>${esc(p.name || "(sin nombre)")}</b>${p.status ? `<span class="tag">${esc(p.status)}</span>` : ""}</span>
    <span class="src">${esc(loc)}${p.address ? ` · ${esc(p.address)}` : ""}</span>
    ${needs ? `<span class="src">Necesita: ${esc(needs)}</span>` : ""}
    <span class="src">fuente: ${esc(c.sourceId)}</span>
  </div>`;
}
async function openCentros() {
  let items = [];
  try { items = (await get("/api/centros")).items || []; } catch { /* offline */ }
  const opts = `<option value="">Todos los estados</option>` + estadosDe(items).map((e) => `<option>${esc(e)}</option>`).join("");
  openSheet("Centros de acopio", `
    <div class="filters">
      <input class="input" id="c-q" placeholder="Buscar por nombre, municipio o dirección…">
      <select class="select" id="c-estado">${opts}</select>
    </div>
    <div class="src" id="c-count"></div>
    <div class="list" id="c-list"></div>`);
  const draw = () => {
    const f = filtrar(items, { estado: el("c-estado").value, q: el("c-q").value });
    el("c-count").textContent = `${f.length} de ${items.length} centros${f.length > 300 ? " · mostrando 300" : ""}`;
    el("c-list").innerHTML = f.length ? f.slice(0, 300).map(centroRow).join("") : `<div class="empty">Sin resultados.</div>`;
  };
  el("c-q").addEventListener("input", draw);
  el("c-estado").addEventListener("change", draw);
  draw();
}

function renderTopnav() {
  el("topnav").innerHTML = `
    <button class="tbtn only-mobile" id="nav-left">☰ Capas</button>
    <button class="tbtn only-mobile" id="nav-right">Feed</button>
    <button class="tbtn" id="nav-centros">Centros</button>
    <button class="tbtn" id="nav-panel">Panel vital</button>
    <button class="tbtn" id="nav-serv">Servicios</button>`;
  el("nav-centros").onclick = openCentros;
  el("nav-panel").onclick = openPanelVital;
  el("nav-serv").onclick = openServicios;
  el("nav-left").onclick = () => { document.body.classList.remove("show-right"); document.body.classList.toggle("show-left"); };
  el("nav-right").onclick = () => { document.body.classList.remove("show-left"); document.body.classList.toggle("show-right"); };
}

async function boot() {
  initMap();
  renderLeft();
  renderTopnav();
  await Promise.all([renderKPIs(), renderFeed()]);
  for (const d of LAYERS.filter((x) => x.on)) {
    const r = await toggleLayer(d, true);
    if (r) el("lc-" + d.key).textContent = r.plotted + (r.items.length > r.plotted ? `/${r.items.length}` : "");
  }
  renderSources();
  setTimeout(() => state.map && state.map.invalidateSize(), 200);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
