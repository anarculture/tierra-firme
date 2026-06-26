/* Orquestador de ingesta. Corre todos los adaptadores read-only → records.
   Scaffold: no-op (cero adaptadores cableados todavía). */
// TODO(Sx): poblar desde sources.manifest.json, correr cada adapter, upsert a Supabase + export JSON estático.
const adapters = []; // TODO(Sx): [{ id, fetchRegistros }]

console.log(`ingest: ${adapters.length} adaptadores cableados (scaffold). TODO(Sx).`);
