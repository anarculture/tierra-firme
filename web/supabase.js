/* Cliente Supabase ligero (fetch, sin SDK). Lee config PÚBLICA de /api/config.
   Solo escritura propia (resolución, voluntarios, asignaciones). La SECRET key NUNCA llega al navegador. */
let _cfg = null;
async function cfg() {
  if (!_cfg) { try { _cfg = await (await fetch("/api/config")).json(); } catch { _cfg = {}; } }
  return _cfg;
}
function H(c, extra) {
  return { apikey: c.supabasePublishableKey, Authorization: "Bearer " + c.supabasePublishableKey, "Content-Type": "application/json", ...extra };
}

export async function sbReady() { const c = await cfg(); return !!(c.supabaseUrl && c.supabasePublishableKey); }

export async function sbInsert(table, row) {
  const c = await cfg();
  const r = await fetch(`${c.supabaseUrl}/rest/v1/${table}`, { method: "POST", headers: H(c, { Prefer: "return=representation" }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`insert ${table} → ${r.status}`);
  return r.json();
}

export async function sbSelect(table, query = "") {
  const c = await cfg();
  const r = await fetch(`${c.supabaseUrl}/rest/v1/${table}${query ? "?" + query : ""}`, { headers: H(c) });
  if (!r.ok) throw new Error(`select ${table} → ${r.status}`);
  return r.json();
}
