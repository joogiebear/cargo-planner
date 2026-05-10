-- Phase 4b — Row Level Security.
--
-- Enables RLS on every table and adds policies that match the role-based
-- gating the client already enforces. Anonymous (unauthenticated) requests
-- are blocked from everything except the audit log INSERT (which we still
-- gate to authenticated users below).
--
-- Roles:
--   admin     — full read/write everywhere
--   regional  — read everywhere, write at their assigned facilities
--   facility  — read everywhere, write at their assigned facilities
--   planner   — read everywhere, write only to plans (jobs/scenarios) at their facilities
--   viewer    — read everywhere, no writes
--
-- The Supabase SQL Editor runs as the service_role which **bypasses RLS**.
-- So our schema/seed/wipe migrations keep working from the dashboard.
-- The JS client uses the user's session (anon → authenticated) so it
-- respects these policies.
--
-- Idempotent — drops + recreates all policies and helpers.

set search_path = public;

-- =====================================================================
-- Helper functions
-- =====================================================================
-- All marked SECURITY DEFINER so they read from `users` without
-- recursing back into RLS policies.

create or replace function current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from users
   where auth_user_id = auth.uid()
      or email = (auth.jwt() ->> 'email')
  limit 1
$$;

create or replace function current_app_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users
   where auth_user_id = auth.uid()
      or email = (auth.jwt() ->> 'email')
  limit 1
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from users
       where auth_user_id = auth.uid()
          or email = (auth.jwt() ->> 'email')
       limit 1),
    false
  )
$$;

create or replace function can_write_plans()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'regional', 'facility', 'planner') from users
       where auth_user_id = auth.uid()
          or email = (auth.jwt() ->> 'email')
       limit 1),
    false
  )
$$;

create or replace function can_write_fleet()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'regional', 'facility') from users
       where auth_user_id = auth.uid()
          or email = (auth.jwt() ->> 'email')
       limit 1),
    false
  )
$$;

create or replace function has_facility_access(fac_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when fac_id is null then false
    when is_admin() then true
    else exists (
      select 1 from user_facility_access
       where user_id = current_app_user_id()
         and facility_id = fac_id
    )
  end
$$;

-- =====================================================================
-- Helper: drop existing policies on a table so re-runs are idempotent
-- =====================================================================
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- =====================================================================
-- facilities
-- =====================================================================
alter table facilities enable row level security;

create policy facilities_select on facilities
  for select to authenticated
  using (true);

create policy facilities_admin_write on facilities
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- =====================================================================
-- users
-- =====================================================================
alter table users enable row level security;

-- Anyone signed in can see all users (so the Admin Users tab works for
-- non-admins too — they see read-only). Plus a row needs to be visible
-- by email match for the very first sign-in (before auth_user_id link).
create policy users_select on users
  for select to authenticated
  using (
    auth.uid() is not null
  );

-- Admin can fully manage. Plus self-update to allow first-sign-in linking
-- of auth_user_id and last_seen_at bumps.
create policy users_admin_all on users
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy users_self_update on users
  for update to authenticated
  using (
    email = (auth.jwt() ->> 'email')
    or auth_user_id = auth.uid()
  )
  with check (
    email = (auth.jwt() ->> 'email')
    or auth_user_id = auth.uid()
  );

-- =====================================================================
-- user_facility_access
-- =====================================================================
alter table user_facility_access enable row level security;

create policy ufa_select on user_facility_access
  for select to authenticated
  using (auth.uid() is not null);

create policy ufa_admin_write on user_facility_access
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- =====================================================================
-- trucks
-- =====================================================================
alter table trucks enable row level security;

create policy trucks_select on trucks
  for select to authenticated
  using (auth.uid() is not null);

create policy trucks_write on trucks
  for all to authenticated
  using (
    is_admin() or (can_write_fleet() and has_facility_access(facility_id))
  )
  with check (
    is_admin() or (can_write_fleet() and has_facility_access(facility_id))
  );

-- =====================================================================
-- crates
-- =====================================================================
alter table crates enable row level security;

create policy crates_select on crates
  for select to authenticated
  using (auth.uid() is not null);

-- Anyone who can write plans (including planners) can create/edit crates.
-- Crates aren't strongly tied to a facility for write-gating in this app
-- model — they're created per-job by the planner.
create policy crates_write on crates
  for all to authenticated
  using (is_admin() or can_write_plans())
  with check (is_admin() or can_write_plans());

-- =====================================================================
-- shipments  (jobs)
-- =====================================================================
alter table shipments enable row level security;

-- Read scope: admin sees all; everyone else sees only jobs at their facilities.
create policy shipments_select on shipments
  for select to authenticated
  using (is_admin() or has_facility_access(origin_facility_id));

-- Write scope: any role allowed to write plans, at their facilities only.
create policy shipments_write on shipments
  for all to authenticated
  using (
    is_admin() or (can_write_plans() and has_facility_access(origin_facility_id))
  )
  with check (
    is_admin() or (can_write_plans() and has_facility_access(origin_facility_id))
  );

-- =====================================================================
-- shipment_crates  (manifests)
-- =====================================================================
alter table shipment_crates enable row level security;

-- Visibility follows the parent shipment.
create policy shipment_crates_select on shipment_crates
  for select to authenticated
  using (
    is_admin() or exists (
      select 1 from shipments s
       where s.id = shipment_crates.shipment_id
         and has_facility_access(s.origin_facility_id)
    )
  );

create policy shipment_crates_write on shipment_crates
  for all to authenticated
  using (
    is_admin() or (
      can_write_plans() and exists (
        select 1 from shipments s
         where s.id = shipment_crates.shipment_id
           and has_facility_access(s.origin_facility_id)
      )
    )
  )
  with check (
    is_admin() or (
      can_write_plans() and exists (
        select 1 from shipments s
         where s.id = shipment_crates.shipment_id
           and has_facility_access(s.origin_facility_id)
      )
    )
  );

-- =====================================================================
-- scenarios + scenario_trucks + scenario_assignments
-- =====================================================================
alter table scenarios enable row level security;

create policy scenarios_select on scenarios
  for select to authenticated
  using (
    is_admin() or facility_id is null or has_facility_access(facility_id)
  );

create policy scenarios_write on scenarios
  for all to authenticated
  using (
    is_admin() or (can_write_plans() and (facility_id is null or has_facility_access(facility_id)))
  )
  with check (
    is_admin() or (can_write_plans() and (facility_id is null or has_facility_access(facility_id)))
  );

alter table scenario_trucks enable row level security;

create policy scenario_trucks_select on scenario_trucks
  for select to authenticated
  using (
    is_admin() or exists (
      select 1 from scenarios s
       where s.id = scenario_trucks.scenario_id
         and (s.facility_id is null or has_facility_access(s.facility_id))
    )
  );

create policy scenario_trucks_write on scenario_trucks
  for all to authenticated
  using (
    is_admin() or (can_write_plans() and exists (
      select 1 from scenarios s
       where s.id = scenario_trucks.scenario_id
         and (s.facility_id is null or has_facility_access(s.facility_id))
    ))
  )
  with check (
    is_admin() or (can_write_plans() and exists (
      select 1 from scenarios s
       where s.id = scenario_trucks.scenario_id
         and (s.facility_id is null or has_facility_access(s.facility_id))
    ))
  );

alter table scenario_assignments enable row level security;

create policy scenario_assignments_select on scenario_assignments
  for select to authenticated
  using (
    is_admin() or exists (
      select 1 from scenarios s
       where s.id = scenario_assignments.scenario_id
         and (s.facility_id is null or has_facility_access(s.facility_id))
    )
  );

create policy scenario_assignments_write on scenario_assignments
  for all to authenticated
  using (
    is_admin() or (can_write_plans() and exists (
      select 1 from scenarios s
       where s.id = scenario_assignments.scenario_id
         and (s.facility_id is null or has_facility_access(s.facility_id))
    ))
  )
  with check (
    is_admin() or (can_write_plans() and exists (
      select 1 from scenarios s
       where s.id = scenario_assignments.scenario_id
         and (s.facility_id is null or has_facility_access(s.facility_id))
    ))
  );

-- =====================================================================
-- audit_log  (append-only)
-- =====================================================================
alter table audit_log enable row level security;

-- Only admin can read audit history.
create policy audit_select_admin on audit_log
  for select to authenticated
  using (is_admin());

-- Any authenticated user can insert their own audit entry.
create policy audit_insert_self on audit_log
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (actor_user_id is null or actor_user_id = current_app_user_id())
  );

-- No UPDATE / DELETE policies → table is effectively append-only for app users.
-- (Service role still bypasses RLS so admins can clean up via SQL Editor.)

-- =====================================================================
-- Sanity check
-- =====================================================================
do $$
declare
  rls_count int;
  policy_count int;
begin
  select count(*) into rls_count
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;
  select count(*) into policy_count
    from pg_policies where schemaname = 'public';
  raise notice 'RLS enabled on % tables, % policies installed.', rls_count, policy_count;
end $$;
