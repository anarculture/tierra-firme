/* F0 health (failable) — conectividad + key contra Supabase REST. Lee .env del repo. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function env() {
  const f = fileURLToPath(new URL("../.env", import.meta.url));
  const out = {};
  if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return { ...out, ...process.env };
}

const E = env();
if (!E.SUPABASE_URL || !E.SUPABASE_SECRET_KEY) { console.error("sb:health — falta .env (SUPABASE_URL / SUPABASE_SECRET_KEY)"); process.exit(1); }
const r = await fetch(`${E.SUPABASE_URL}/rest/v1/`, { headers: { apikey: E.SUPABASE_SECRET_KEY, Authorization: "Bearer " + E.SUPABASE_SECRET_KEY } });
console.log("Supabase REST:", r.status);
process.exit(r.ok ? 0 : 1);
