-- Cargo Planner — bootstrap your first admin user.
-- Run AFTER schema.sql + seed.sql.
-- Idempotent: re-running just keeps your row up to date.

set search_path = public;

-- Adds (or updates) the admin row.
insert into users (legacy_id, name, email, role, status, invited_at) values
  ('u-me', 'Admin', 'zemeckisv1990@gmail.com', 'admin', 'active', now())
on conflict (email) do update set
  role   = 'admin',
  status = 'active';

-- Grant access to every facility.
insert into user_facility_access (user_id, facility_id)
select u.id, f.id
from users u, facilities f
where u.email = 'zemeckisv1990@gmail.com'
on conflict (user_id, facility_id) do nothing;

do $$
declare
  uid uuid;
  fac_count int;
begin
  select id into uid from users where email = 'zemeckisv1990@gmail.com';
  select count(*) into fac_count from user_facility_access where user_id = uid;
  raise notice 'Admin user id = %, facility access rows = %', uid, fac_count;
end $$;
