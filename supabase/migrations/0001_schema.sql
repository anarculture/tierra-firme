-- monitorVE — esquema (STUB, sin datos). Capa propia + caché de espejo.
-- LEY: índice/espejo. Solo poseemos clusters + resolutions + curated (Q2/Q6).
-- TODO(Sx): completar columnas, índices, PostGIS y RLS al implementar cada capa.

-- Registro de Fuentes (espejo del manifiesto, para trazabilidad de corridas).
create table if not exists sources (
  id           text primary key,
  nombre       text not null,
  url          text,
  categoria    text[],          -- TODO(Sx)
  exposicion   text,            -- api-json | implicit-api | scrape | feed | curada | federacion | link-only
  confianza    text,            -- oficial | org | comunitario | sin-verificar
  activa       boolean default true,
  ultima_corrida timestamptz
);

-- Caché de registros espejados (read-only respecto a la Fuente).
create table if not exists records (
  id         bigint generated always as identity primary key,
  source_id  text references sources(id),
  categoria  text not null,     -- ver CATEGORIAS en src/model
  payload    jsonb not null,    -- TODO(Sx): normalizar por categoría
  -- coords geography(point)    -- TODO(Sx): PostGIS
  fetched_at timestamptz default now()
);

-- PROPIO: clústeres de identidad. Enlazar, no fusionar; sesgo a separar (ADR 0001).
create table if not exists clusters (
  id         bigint generated always as identity primary key,
  categoria  text not null,
  miembros   bigint[],          -- record ids; TODO(Sx)
  confianza  text not null      -- confirmado | posible
);

-- PROPIO: única intake = resolución ("ya apareció").
create table if not exists resolutions (
  id           bigint generated always as identity primary key,
  record_id    bigint,
  cluster_id   bigint,
  estado       text not null default 'localizada',
  reportado_por text,
  confirmado_por text,
  at           timestamptz default now()
);

-- PROPIO: entradas curadas (panel vital + servicios + donaciones) con procedencia.
create table if not exists curated (
  id           bigint generated always as identity primary key,
  tipo         text not null,
  titulo       text not null,
  contacto     jsonb,
  categoria    text,
  fuente_origen text,           -- de dónde se transcribió (p.ej. @fceunimet)
  verificado_el date
);
