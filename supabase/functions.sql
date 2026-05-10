-- Cargo Planner — RPCs
-- Run AFTER schema.sql (and any time you change these functions).
-- Idempotent: `create or replace`.

set search_path = public;

-- ---------------------------------------------------------------------
-- save_scenario(payload jsonb) → jsonb { id }
--
-- Atomic upsert of one scenario plus its child fleet + assignments.
-- Re-saving with the same id replaces ALL child rows in one transaction
-- so we never end up with duplicated trucks/assignments.
--
-- Expected payload shape:
-- {
--   "id": "uuid-or-null",
--   "name": "string",
--   "facility_id": "uuid-or-null",
--   "shipment_id": "uuid-or-null",
--   "status": "draft" | "active" | "archived",
--   "author_user_id": "uuid-or-null",
--   "summary": { ... arbitrary jsonb ... },
--   "trucks": [ { "truck_id": "uuid" }, ... ],
--   "assignments": [ { "crate_id": "uuid", "truck_id": "uuid",
--                      "position": null|jsonb, "seq": int|null }, ... ]
-- }
-- ---------------------------------------------------------------------

create or replace function save_scenario(payload jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  scen_id uuid;
begin
  insert into scenarios (
    id, name, facility_id, shipment_id, status, author_user_id, summary
  )
  values (
    coalesce(nullif(payload->>'id','')::uuid, gen_random_uuid()),
    payload->>'name',
    nullif(payload->>'facility_id','')::uuid,
    nullif(payload->>'shipment_id','')::uuid,
    coalesce(nullif(payload->>'status','')::scenario_status, 'active'),
    nullif(payload->>'author_user_id','')::uuid,
    coalesce(payload->'summary', '{}'::jsonb)
  )
  on conflict (id) do update set
    name           = excluded.name,
    facility_id    = excluded.facility_id,
    shipment_id    = excluded.shipment_id,
    status         = excluded.status,
    author_user_id = excluded.author_user_id,
    summary        = excluded.summary,
    updated_at     = now()
  returning id into scen_id;

  delete from scenario_trucks       where scenario_id = scen_id;
  delete from scenario_assignments  where scenario_id = scen_id;

  insert into scenario_trucks (scenario_id, truck_id)
  select scen_id, (t->>'truck_id')::uuid
  from jsonb_array_elements(coalesce(payload->'trucks', '[]'::jsonb)) t;

  insert into scenario_assignments (scenario_id, crate_id, truck_id, position, seq)
  select
    scen_id,
    (a->>'crate_id')::uuid,
    (a->>'truck_id')::uuid,
    a->'position',
    nullif(a->>'seq','')::int
  from jsonb_array_elements(coalesce(payload->'assignments', '[]'::jsonb)) a;

  return jsonb_build_object('id', scen_id);
end;
$$;

-- Allow the anon role to call it.
-- (RLS will enforce per-user access in Phase 4 — for now anon = trusted client.)
grant execute on function save_scenario(jsonb) to anon, authenticated;
