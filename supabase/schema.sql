-- Cargo Planner — Postgres schema
-- Paste this into the Supabase SQL Editor (or run via psql).
-- Idempotent: safe to re-run during development.

set search_path = public;

create extension if not exists "pgcrypto";

-- =====================================================================
-- enums
-- =====================================================================

do $$ begin
  create type user_role       as enum ('admin', 'regional', 'facility', 'planner', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status     as enum ('active', 'invited', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type truck_type      as enum ('Sprinter Van', '24'' Box', '26'' Box', '53'' Trailer', '24'' Box (EU)');
exception when duplicate_object then null; end $$;

do $$ begin
  create type medium_code     as enum ('PNT', 'SCL', 'WRK', 'MIX', 'DEC', 'PHT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type crate_orient    as enum ('UP', 'ANY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shipment_status as enum ('planning', 'ready', 'loaded', 'in_transit', 'delivered', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scenario_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_kind      as enum ('edit', 'create', 'delete', 'auth', 'system');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- updated_at trigger helper
-- =====================================================================

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- facilities
-- =====================================================================

create table if not exists facilities (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,                       -- prototype id, e.g. 'f-bk'
  code        text not null unique,              -- 'BK', 'LIC', 'LA', 'LDN'
  name        text not null,
  city        text,
  address     text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_facilities_updated_at on facilities;
create trigger trg_facilities_updated_at
  before update on facilities
  for each row execute function set_updated_at();

create index if not exists idx_facilities_archived on facilities(archived);

-- =====================================================================
-- users
-- =====================================================================

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     text unique,                     -- prototype id, e.g. 'u-02'
  auth_user_id  uuid unique,                     -- maps to auth.users.id once auth is wired
  name          text not null,
  email         text not null unique,
  role          user_role not null,
  status        user_status not null default 'active',
  invited_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

create index if not exists idx_users_role on users(role);

-- =====================================================================
-- user_facility_access  (many-to-many)
-- =====================================================================

create table if not exists user_facility_access (
  user_id      uuid not null references users(id) on delete cascade,
  facility_id  uuid not null references facilities(id) on delete cascade,
  granted_by   uuid references users(id) on delete set null,
  granted_at   timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create index if not exists idx_ufa_facility on user_facility_access(facility_id);

-- =====================================================================
-- trucks
-- =====================================================================

create table if not exists trucks (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       text unique,
  facility_id     uuid not null references facilities(id) on delete restrict,
  ref             text not null,
  model           text not null,
  type            truck_type not null,
  length_in       int not null check (length_in > 0),
  width_in        int not null check (width_in > 0),
  height_in       int not null check (height_in > 0),
  max_lbs         int not null check (max_lbs > 0),
  axles           smallint not null default 2,
  out_of_service  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (facility_id, ref)
);

drop trigger if exists trg_trucks_updated_at on trucks;
create trigger trg_trucks_updated_at
  before update on trucks
  for each row execute function set_updated_at();

create index if not exists idx_trucks_facility_active on trucks(facility_id, out_of_service);

-- =====================================================================
-- crates
-- =====================================================================

create table if not exists crates (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         text unique,
  ref               text not null unique,
  title             text not null,
  artist            text,
  year              smallint,
  medium            medium_code not null,
  length_in         int not null check (length_in > 0),
  width_in          int not null check (width_in > 0),
  height_in         int not null check (height_in > 0),
  weight_lbs        int not null check (weight_lbs > 0),
  value_cents       bigint not null default 0,
  fragile           boolean not null default true,
  orient            crate_orient not null default 'UP',
  stack             boolean not null default false,
  flat              boolean not null default false,
  glass             boolean not null default false,
  home_facility_id  uuid references facilities(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_crates_updated_at on crates;
create trigger trg_crates_updated_at
  before update on crates
  for each row execute function set_updated_at();

create index if not exists idx_crates_home    on crates(home_facility_id);
create index if not exists idx_crates_medium  on crates(medium);

-- =====================================================================
-- shipments
-- =====================================================================

create table if not exists shipments (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             text unique,
  ref                   text not null unique,
  name                  text not null,
  origin_facility_id    uuid not null references facilities(id) on delete restrict,
  destination           text not null,
  pickup_date           date,
  arrive_window_start   date,
  arrive_window_end     date,
  handler_user_id       uuid references users(id) on delete set null,
  status                shipment_status not null default 'planning',
  loaded_at             timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_shipments_updated_at on shipments;
create trigger trg_shipments_updated_at
  before update on shipments
  for each row execute function set_updated_at();

create index if not exists idx_shipments_origin_status on shipments(origin_facility_id, status);
create index if not exists idx_shipments_handler       on shipments(handler_user_id);

-- =====================================================================
-- shipment_crates  (manifest membership)
-- =====================================================================

create table if not exists shipment_crates (
  shipment_id  uuid not null references shipments(id) on delete cascade,
  crate_id     uuid not null references crates(id)    on delete restrict,
  added_at     timestamptz not null default now(),
  primary key (shipment_id, crate_id)
);

create index if not exists idx_shipment_crates_crate on shipment_crates(crate_id);

-- =====================================================================
-- scenarios
-- =====================================================================

create table if not exists scenarios (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         text unique,
  name              text not null,
  shipment_id       uuid references shipments(id) on delete cascade,
  facility_id       uuid references facilities(id) on delete set null,
  status            scenario_status not null default 'draft',
  author_user_id    uuid references users(id) on delete set null,
  summary           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_scenarios_updated_at on scenarios;
create trigger trg_scenarios_updated_at
  before update on scenarios
  for each row execute function set_updated_at();

create index if not exists idx_scenarios_shipment_status on scenarios(shipment_id, status);
create index if not exists idx_scenarios_facility        on scenarios(facility_id);
create index if not exists idx_scenarios_author          on scenarios(author_user_id);

-- =====================================================================
-- scenario_trucks  (fleet for a saved scenario, including empty trucks)
-- =====================================================================

create table if not exists scenario_trucks (
  scenario_id  uuid not null references scenarios(id) on delete cascade,
  truck_id     uuid not null references trucks(id)    on delete restrict,
  primary key (scenario_id, truck_id)
);

create index if not exists idx_scenario_trucks_truck on scenario_trucks(truck_id);

-- =====================================================================
-- scenario_assignments  (per-crate placement)
-- =====================================================================

create table if not exists scenario_assignments (
  scenario_id  uuid not null references scenarios(id) on delete cascade,
  crate_id     uuid not null references crates(id)    on delete restrict,
  truck_id     uuid not null references trucks(id)    on delete restrict,
  position     jsonb,
  seq          int,
  primary key (scenario_id, crate_id)
);

create index if not exists idx_assign_scenario_truck on scenario_assignments(scenario_id, truck_id);
create index if not exists idx_assign_truck_scenario on scenario_assignments(truck_id, scenario_id);

-- =====================================================================
-- audit_log  (append-only)
-- =====================================================================

create table if not exists audit_log (
  id              bigserial primary key,
  t               timestamptz not null default now(),
  actor_user_id   uuid references users(id) on delete set null,
  kind            audit_kind not null,
  action          text not null,
  target          text,
  entity_type     text,
  entity_id       uuid,
  meta            jsonb
);

create index if not exists idx_audit_t            on audit_log(t desc);
create index if not exists idx_audit_actor_t      on audit_log(actor_user_id, t desc);
create index if not exists idx_audit_entity_t     on audit_log(entity_type, entity_id, t desc);

-- =====================================================================
-- RLS NOTE
-- =====================================================================
-- Row-level security is intentionally NOT enabled in this migration.
-- It will be added together with auth wire-up in Phase 4.
-- Until then, treat the database as trusted-client-only and do not
-- expose the anon key beyond local development.
