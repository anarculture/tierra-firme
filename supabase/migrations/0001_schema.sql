-- monitorVE — esquema Supabase. Capa propia (índice) + coordinación (despachador).
-- Lectura pública = JSON estático (CDN). Supabase = escritura/fuente-de-verdad de lo propio.
-- Idempotente: re-ejecutable en el SQL editor.

-- ── Espejo / trazabilidad ────────────────────────────────────────────
create table if not exists sources (
  id text primary key, nombre text not null, url text,
  categoria text[], exposicion text, confianza text,
  activa boolean default true, ultima_corrida timestamptz
);
create table if not exists records (
  id bigint generated always as identity primary key,
  source_id text references sources(id), categoria text not null,
  payload jsonb not null, fetched_at timestamptz default now()
);

-- ── PROPIO: clústeres + resolución + curado ──────────────────────────
create table if not exists clusters (
  id bigint generated always as identity primary key,
  categoria text not null, miembros bigint[], confianza text not null  -- confirmado | posible
);
create table if not exists resolutions (  -- única intake pública ("ya apareció")
  id bigint generated always as identity primary key,
  record_id bigint, cluster_id bigint, estado text not null default 'localizada',
  reportado_por text, confirmado_por text, at timestamptz default now()
);
create table if not exists curated (
  id bigint generated always as identity primary key,
  tipo text not null, titulo text not null, contacto jsonb, categoria text,
  fuente_origen text, verificado_el date
);

-- ── COORDINACIÓN (despachador real) ──────────────────────────────────
create table if not exists volunteers (
  id bigint generated always as identity primary key,
  nombre text not null, telefono text, skills text[] default '{}',
  zona text, disponibilidad text, activo boolean default true,
  created_at timestamptz default now()
);
create table if not exists resources (
  id bigint generated always as identity primary key,
  tipo text not null, cantidad numeric, unidad text, ubicacion text, donante text,
  created_at timestamptz default now()
);
create table if not exists needs (
  id bigint generated always as identity primary key,
  tipo text not null, estado text, nivel text, centro_ref text,
  cubierta boolean default false, created_at timestamptz default now()
);
create table if not exists assignments (
  id bigint generated always as identity primary key,
  need_id bigint references needs(id),
  volunteer_id bigint references volunteers(id),
  resource_id bigint references resources(id),
  estado text not null default 'asignada',   -- asignada | en_curso | entregada | cancelada
  responsable text, evidencia_url text, log jsonb default '[]'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ── RLS: lectura pública de coordinación; escritura granular en C2/C3 ─
-- (el colector/operador server-side usa la SECRET key, que bypassa RLS)
alter table volunteers   enable row level security;
alter table resources    enable row level security;
alter table needs        enable row level security;
alter table assignments  enable row level security;
alter table resolutions  enable row level security;

drop policy if exists pub_read_volunteers  on volunteers;  create policy pub_read_volunteers  on volunteers  for select using (true);
drop policy if exists pub_read_resources   on resources;   create policy pub_read_resources   on resources   for select using (true);
drop policy if exists pub_read_needs       on needs;       create policy pub_read_needs       on needs       for select using (true);
drop policy if exists pub_read_assignments on assignments; create policy pub_read_assignments on assignments for select using (true);
drop policy if exists pub_read_resolutions on resolutions; create policy pub_read_resolutions on resolutions for select using (true);
-- resolución: única intake pública de escritura
drop policy if exists pub_insert_resolutions on resolutions; create policy pub_insert_resolutions on resolutions for insert with check (true);
