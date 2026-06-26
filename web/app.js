/* SPA shell — monitorVE. Vanilla, sin framework/build. Solo dibuja los 6 pilares como stubs.
   LECTURA vía web/api.js (→ /api/* stub). Escritura (resolución) → Supabase (TODO). */
import { get } from "./api.js";

// Pilares del plan (A–F). Cada uno es una pantalla por implementar.
const PILARES = [
  { id: "tablero", t: "Tablero situacional", todo: "TODO(Sx): cifras + frescura + alertas" },
  { id: "personas", t: "Personas (buscar / resolución)", todo: "TODO(Sx): búsqueda cross-source + clusters + 'ya apareció'" },
  { id: "directorio", t: "Centros, refugios y donaciones", todo: "TODO(Sx): directorio accionable" },
  { id: "mapa", t: "Mapa (daños / centros)", todo: "TODO(Sx): Leaflet/OSM" },
  { id: "servicios", t: "Catálogo de servicios", todo: "TODO(Sx): curado (telemedicina, psico, estructural...)" },
  { id: "panel", t: "Panel vital + Réplicas", todo: "TODO(Sx): contactos urgencia + pronóstico réplicas" }
];

function render() {
  const root = document.getElementById("app");
  root.innerHTML = `
    <header class="hd"><h1>monitorVE</h1><p>Índice de la crisis sísmica · scaffold</p></header>
    <main class="grid">
      ${PILARES.map(p => `<section class="card"><b>${p.t}</b><small>${p.todo}</small></section>`).join("")}
    </main>
    <footer class="ft"><span id="health">api: …</span> · iniciativa comunitaria, no oficial</footer>`;
  // prueba de vida del api stub
  get("/api/health").then(h => { document.getElementById("health").textContent = "api: " + (h.ok ? "ok (stub)" : "?"); })
    .catch(() => { document.getElementById("health").textContent = "api: offline"; });
}

render();

// Offline (red mala). Registro best-effort; el SW real es un stub. TODO(Sx).
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
