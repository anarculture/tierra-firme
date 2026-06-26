/* Modelo de datos — monitorVE. Tipos/constantes vacíos (sin lógica de negocio).
   LEY DE ESTRUCTURA (ver CONTEXT.md + docs/adr/0001 + plan):
   - Somos ÍNDICE/espejo, no sistema de registro (Q1).
   - Única intake = Señal de resolución ("ya apareció") (Q1/Q2).
   - Capa propia = clústeres dedup + resolución + entradas curadas (Q2/Q6).
   - Persona = sujeto con estado desaparecida→localizada (Q3).
   - Reportante = contacto, entidad APARTE (no se dedupea por su teléfono) (Q3).
   - Localización = evidencia (hospital/avistamiento) que puede resolver una Persona (Q3).
   - Clúster = ENLACE, no fusión; sesgo a separar (ADR 0001).
   TODO(Sx): añadir validadores/factories cuando se implemente cada capa. */

export const ESTADO_PERSONA = Object.freeze({ DESAPARECIDA: "desaparecida", LOCALIZADA: "localizada" });
export const CONFIANZA_CLUSTER = Object.freeze({ CONFIRMADO: "confirmado", POSIBLE: "posible" });
export const NIVEL_CONFIANZA = Object.freeze({ OFICIAL: "oficial", ORG: "org", COMUNITARIO: "comunitario", SIN_VERIFICAR: "sin-verificar" });
export const CATEGORIAS = Object.freeze(["persona", "localizacion", "centro", "refugio", "donacion", "dano", "servicio", "mascota", "replica"]);

/**
 * @typedef {Object} Registro  Registro de fuente espejado (read-only; la Fuente lo posee).
 * @property {string} sourceId  @property {string} categoria @property {Object} payload
 * @property {{lat:number,lng:number}|null} coords @property {string} fetchedAt
 */
/**
 * @typedef {Object} Persona  Sujeto buscado/localizado.
 * @property {string} nombre @property {string=} apellido @property {number=} edad
 * @property {string} estado  uno de ESTADO_PERSONA
 */
/** @typedef {Object} Reportante  Contacto que reporta; entidad APARTE de Persona. */
/** @typedef {Object} Localizacion  Evidencia que ubica a una Persona (hospital/avistamiento). */
/** @typedef {Object} Cluster  Enlace de Registros = misma entidad; CONFIANZA_CLUSTER. No fusiona. */
/** @typedef {Object} Resolucion  Única intake: marca "ya apareció" sobre un Registro/Clúster. */
/** @typedef {Object} EntradaCurada  Panel vital / servicio; con fuenteOrigen + verificadoEl. */

// TODO(Sx): exportar validadores (p.ej. assertPersona) cuando dedup/resolución los necesiten.
