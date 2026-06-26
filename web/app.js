/* monitorVE — consola situacional (ADR 0003). El mapa es la app. Leaflet global (L).
   Densidad sobre estética · marcadores tipados por _kind · degradación elegante (útil con cero datos). */
import { get } from "./api.js";
import { needsPorEstado } from "./gaps.js";
import { filtrar, estadosDe } from "./centros-filter.js";
import { nextSheetState } from "./sheet.js";
import { jitter } from "./jitter.js";
import { confianza, CONF_COLOR } from "./confianza.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function confBadge(sourceId) {
  const c = confianza(sourceId);
  const color = CONF_COLOR[c.nivel] || "#8b93a3";
  return `<span class="conf" style="color:${color};border-color:${color}66"${c.razon ? ` title="${esc(c.razon)}"` : ""}>${esc(c.label)}</span>`;
}
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
const isMobile = () => window.matchMedia("(max-width: 860px)").matches;
const panelTarget = () => (isMobile() ? "sheet-content" : "right");

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
  const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap, © CARTO", subdomains: "abcd", maxZoom: 19
  });
  // Tiles requieren red; si fallan, los marcadores vectoriales siguen visibles sobre el fondo oscuro.
  tiles.on("tileerror", () => { if (!state.tileError) { state.tileError = true; renderSources(); } });
  tiles.addTo(map);
  state.map = map;
}

function addMarker(group, def, item) {
  const c = item.coords; if (!c || c.lat == null || c.lng == null) return false;
  const mag = item.payload?.mag;
  const isEpi = def.key === "epicentro";
  // Ubicación aproximada (centroide de estado): dispersar con jitter determinista y marcar distinto.
  const aprox = c.source === "estado" || c.confidence === "baja";
  const seed = [item.payload?.name, item.payload?.address, item.payload?.estado].filter(Boolean).join("|") || item.sourceId || def.key;
  const pos = aprox ? jitter(c.lat, c.lng, seed) : { lat: c.lat, lng: c.lng };
  // Marcador tipado: el glifo del _kind (coincide con la leyenda), tamaño ≈ magnitud.
  const size = isEpi ? Math.max(20, (mag || 6) * 3) : Math.max(13, (mag || 4) * 2.4);
  const icon = L.divIcon({
    className: aprox ? "mk mk-aprox" : "mk",
    html: `<span style="color:${def.color};font-size:${size}px">${def.sym}</span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
  const title = (item.payload?.place || item.payload?.name || def.label) + (aprox ? " (ubicación aprox. — estado)" : "");
  const m = L.marker([pos.lat, pos.lng], { icon, title });
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

// Panel de capas — markup + wiring scopeados a un contenedor (sirve en #left [desktop] y overlay [móvil]).
function layerActivo(d) { return !!(state.groups[d.key] && state.map && state.map.hasLayer(state.groups[d.key])); }
function capasHtml() {
  const rows = LAYERS.map((d) => {
    const checked = state.groups[d.key] ? layerActivo(d) : d.on;
    const lc = state.loaded[d.key] ? state.loaded[d.key].plotted : "—";
    return `<label class="layer">
      <input type="checkbox" data-layer="${d.key}" ${checked ? "checked" : ""}>
      <span class="sym" style="color:${d.color}">${d.sym}</span>
      <span class="lname">${esc(d.label)}</span>
      <span class="lcount" data-lc="${d.key}">${lc}</span>
    </label>`;
  }).join("");
  return `<h3>Capas</h3>${rows}
    <h3>Heatmap de gaps</h3>
    <label class="layer"><input type="checkbox" class="choro-on" ${choro.on ? "checked" : ""}><span class="lname">Necesidad por estado</span></label>
    <div class="lede choro-scale" style="font-size:11px">Colorea estados por necesidades reportadas (demand vs cobertura).</div>
    <h3>Leyenda</h3>
    <div class="lede" style="font-size:12px">Tamaño ≈ magnitud. Anillo punteado = área estimada (epicentros). Cada dato lleva su fuente.</div>`;
}
function wireCapas(container) {
  container.querySelectorAll("input[data-layer]").forEach((inp) => {
    inp.addEventListener("change", async (e) => {
      const def = LAYERS.find((x) => x.key === e.target.dataset.layer);
      const r = await toggleLayer(def, e.target.checked);
      const lc = container.querySelector(`[data-lc="${def.key}"]`);
      if (r && lc) lc.textContent = r.plotted + (r.items.length > r.plotted ? `/${r.items.length}` : "");
      renderSources();
      if (choro.on) renderChoro(container);
    });
  });
  const cb = container.querySelector(".choro-on");
  if (cb) cb.addEventListener("change", (e) => { choro.on = e.target.checked; renderChoro(container); });
}
function renderLeft(target = "left") { const c = el(target); if (!c) return; c.innerHTML = capasHtml(); wireCapas(c); }

/* Heatmap de gaps: colorea estados por necesidades reportadas (centros.needs). */
const choro = { on: false, layer: null, geo: null };
async function ensureEstados() {
  if (!choro.geo) { const r = await fetch("ve-estados.geojson"); choro.geo = await r.json(); }
  return choro.geo;
}
function choroColor(n, max) {
  if (!n) return "#1a1f2b";
  const r = n / max;
  return r > 0.66 ? "#e5484d" : r > 0.33 ? "#e0a33e" : "#3fb27f";
}
async function renderChoro(container) {
  if (!choro.on) { if (choro.layer) { state.map.removeLayer(choro.layer); choro.layer = null; } return; }
  const geo = await ensureEstados();
  let centros = [];
  try { centros = (await get("/api/centros")).items || []; } catch { /* offline */ }
  const agg = needsPorEstado(centros); // { estado: { needs, centros } }
  let max = 1;
  for (const k in agg) if (agg[k].needs > max) max = agg[k].needs;
  if (choro.layer) state.map.removeLayer(choro.layer);
  choro.layer = L.geoJSON(geo, {
    style: (f) => { const a = agg[f.properties.name]; const n = a ? a.needs : 0; return { color: "#2e3850", weight: 1, fillColor: choroColor(n, max), fillOpacity: n ? 0.55 : 0.06 }; },
    onEachFeature: (f, layer) => { const a = agg[f.properties.name] || { needs: 0, centros: 0 }; layer.bindTooltip(`${f.properties.name}: ${a.needs} necesidades · ${a.centros} centros`, { sticky: true }); }
  });
  choro.layer.addTo(state.map);
  choro.layer.bringToBack();
  const _s = (container || document).querySelector(".choro-scale");
  if (_s) _s.textContent = `Necesidad por estado (máx ${max}) · color = necesidades; tooltip = cobertura.`;
}

async function renderFeed(target = "right") {
  const c = el(target);
  if (!c) return;
  let rep = { items: [] }, sit = { items: [] };
  try { rep = await get("/api/replicas"); } catch {}
  try { sit = await get("/api/sitreps"); } catch {}
  const sitreps = (sit.items || []).map((s) => `<div class="feed-item"><b>${esc(s.titulo)}</b> ${confBadge("monitorVE")}<div style="font-size:13px">${esc(s.texto)}</div><div class="src">${esc(s.zona)} · ${esc(s.fuenteOrigen)} · ${esc(s.verificadoEl)}</div></div>`).join("");
  const items = (rep.items || []).slice(0, 12);
  const body = items.length
    ? items.map((r) => `<div class="feed-item"><span class="feed-mag">M${esc(r.payload?.mag ?? "?")}</span> ${esc(r.payload?.place || "—")}<div class="src">${esc(r.sourceId)} ${confBadge(r.sourceId)} · ${hace(r.payload?.time || r.fetchedAt)}</div></div>`).join("")
    : `<div class="empty">Sin actividad sísmica en la ventana, o la fuente no está disponible ahora.</div>`;
  c.innerHTML = (sitreps ? `<h3>Reportes verificados</h3>${sitreps}` : "") + `<h3>Feed · últimas réplicas</h3>${body}`;
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
  const target = panelTarget();
  const c = el(target);
  if (!c) return;
  c.innerHTML = `
    <div class="detail">
      <h4><span style="color:${def.color}">${def.sym}</span> ${esc(def.label.replace(/s$/, ""))}</h4>
      <div class="card">${rows.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>
      ${item.nota ? `<div class="src" style="margin-top:8px">${esc(item.nota)}</div>` : ""}
      <div class="src">Fuente: ${esc(src)} ${confBadge(item.sourceId)}${item.verificadoEl ? ` · verificado ${esc(item.verificadoEl)}` : ""}</div>
      <button class="tbtn" style="margin-top:12px" id="back-feed">← Volver al feed</button>
    </div>`;
  el("back-feed").addEventListener("click", () => renderFeed(target));
  if (isMobile()) { const sh = el("sheet"); if (sh) { sh.dataset.state = "half"; sh.classList.remove("peek", "full"); sh.classList.add("half"); } }
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
  const tile = state.tileError ? `<span class="shealth"><span class="dot stale"></span>mapa: tiles sin conexión</span>` : "";
  el("sources").innerHTML = `<span class="shealth"><b>Fuentes</b></span>` + tile + parts.join("");
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
    <span class="src">fuente: ${esc(c.sourceId)} ${confBadge(c.sourceId)}</span>
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
    <button class="tbtn only-mobile" id="nav-capas">Capas</button>
    <button class="tbtn" id="nav-centros">Centros</button>
    <button class="tbtn" id="nav-panel">Panel vital</button>
    <button class="tbtn" id="nav-serv">Servicios</button>`;
  el("nav-capas").onclick = openCapas;
  el("nav-centros").onclick = openCentros;
  el("nav-panel").onclick = openPanelVital;
  el("nav-serv").onclick = openServicios;
}

// Capas como overlay (móvil): reusa el mismo markup/wiring que el riel desktop.
function openCapas() {
  openSheet("Capas", capasHtml());
  const c = el("overlay").querySelector(".sheet");
  if (c) wireCapas(c);
}

// Bottom-sheet móvil: feed dentro + handle que cicla peek/half/full. (Desktop: #sheet display:none.)
function initSheet() {
  const sheet = el("sheet"); if (!sheet) return;
  renderFeed("sheet-content");
  el("sheet-handle").addEventListener("click", () => {
    const next = nextSheetState(sheet.dataset.state || "peek");
    sheet.dataset.state = next;
    sheet.classList.remove("peek", "half", "full");
    sheet.classList.add(next);
  });
}

async function boot() {
  initMap();
  renderTopnav();
  await Promise.all([renderKPIs(), renderFeed()]);
  for (const d of LAYERS.filter((x) => x.on)) await toggleLayer(d, true);
  renderLeft(); // tras los toggles → los conteos ya están poblados
  renderSources();
  initSheet();
  setTimeout(() => state.map && state.map.invalidateSize(), 200);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
