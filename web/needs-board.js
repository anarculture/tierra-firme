/* Needs board — agrega necesidades por tipo × estado, ordenadas por urgencia. Puro.
   Primer eslabón del despachador: "qué falta, dónde, con qué urgencia". */
const URGENCIA = { critica: 3, "crítica": 3, alta: 2, media: 1, baja: 0 };
const norm = (s) => String(s || "").replace(/\s*\(.*\)\s*/g, "").trim();

export function urgencyRank(nivel) { return URGENCIA[String(nivel || "").toLowerCase()] ?? 0; }

/** @returns {{tipo:string,estado:string,nivel:string,centros:number}[]} ordenado por urgencia, luego nº de centros */
export function agregarNeeds(centros) {
  const map = {};
  for (const c of centros || []) {
    const estado = norm(c.payload?.estado);
    for (const n of c.payload?.needs || []) {
      const tipo = n.key || n.tipo;
      if (!tipo) continue;
      const k = tipo + "|" + estado;
      if (!map[k]) map[k] = { tipo, estado, nivel: n.level || "", centros: 0 };
      map[k].centros += 1;
      if (urgencyRank(n.level) > urgencyRank(map[k].nivel)) map[k].nivel = n.level;
    }
  }
  return Object.values(map).sort((a, b) => urgencyRank(b.nivel) - urgencyRank(a.nivel) || b.centros - a.centros);
}
