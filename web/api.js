/* Cliente de LECTURA. Lee del propio backend (/api/* stub) o, en prod, de bundles JSON estáticos. */
export async function get(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

/* Escritura: ÚNICA intake = resolución. Va a Supabase, no a las Fuentes.
   TODO(Sx): import { createClient } from '@supabase/supabase-js' y exponer markResolved(). */
export async function markResolved(_input) {
  throw new Error("resolución (web): TODO(Sx) — wire Supabase client");
}
