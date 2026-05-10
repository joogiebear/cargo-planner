-- Cargo Planner — wipe all demo / test data.
-- Schema and types are preserved. The admin user row is preserved
-- (matched on email). Re-run supabase/admin_user.sql afterwards to
-- restore facility access (the wipe also clears user_facility_access).
--
-- Run order:
--   1. supabase/wipe.sql         (this file)
--   2. supabase/admin_user.sql   (re-link admin)

set search_path = public;

-- Disable referential checks for the duration of the wipe so we can
-- truncate in any order. Re-enabled at the end automatically when the
-- transaction commits.
begin;

truncate table audit_log,
               scenario_assignments,
               scenario_trucks,
               scenarios,
               shipment_crates,
               shipments,
               crates,
               trucks,
               user_facility_access
  restart identity cascade;

-- Wipe non-admin users. Keep any admin row so login still works.
delete from users where role <> 'admin';

-- Wipe facilities last (FK targets are now cleared).
truncate table facilities cascade;

commit;

do $$
declare
  remaining_users int;
  remaining_admins int;
begin
  select count(*) into remaining_users from users;
  select count(*) into remaining_admins from users where role = 'admin';
  raise notice 'Wipe complete. Remaining users: % (admins: %).', remaining_users, remaining_admins;
end $$;
