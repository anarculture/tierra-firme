/* Nivel de confianza por fuente (procedencia → confianza). Puro.
   Derivado de sources.manifest.json (campo `confianza`). Default: comunitario sin verificar. */
const MAP = {
  usgs: { nivel: "oficial", label: "Oficial" },
  emsc: { nivel: "oficial", label: "Oficial" },
  sismosve: { nivel: "org", label: "Org" },
  curado: { nivel: "curado", label: "Curado" },
  monitorVE: { nivel: "verificado", label: "Verificado ✓" }
};
const COMUNITARIO = {
  nivel: "comunitario",
  label: "Comunitario",
  razon: "Reporte comunitario sin verificación independiente — confirmá por tus medios."
};

export function confianza(sourceId) {
  return MAP[sourceId] || COMUNITARIO;
}

export const CONF_COLOR = {
  oficial: "#4c8dff",
  org: "#3fb27f",
  curado: "#3fb27f",
  verificado: "#3fb27f",
  comunitario: "#e0a33e",
  "sin-verificar": "#e5484d"
};
