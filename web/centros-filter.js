/* Filtro de centros — puro (sin DOM): usable en el navegador y testeable en node. */
function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

export function estadosDe(items) {
  return [...new Set(items.map((c) => c.payload?.estado).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

export function filtrar(items, { estado = "", q = "" } = {}) {
  const nq = norm(q).trim();
  return items.filter((c) => {
    if (estado && (c.payload?.estado || "") !== estado) return false;
    if (nq) {
      const hay = norm([c.payload?.name, c.payload?.municipio, c.payload?.address].filter(Boolean).join(" "));
      if (!hay.includes(nq)) return false;
    }
    return true;
  });
}
