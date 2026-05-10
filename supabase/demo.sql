-- Cargo Planner — demo data for kicking the tires.
-- Run AFTER wipe.sql + admin_user.sql so you have a clean DB and your
-- admin still works.
--
-- Creates: 4 facilities, 5 non-admin users (with facility access), 9 trucks
-- (Sprinter/ST/TT mix), 14 crates as inventory, plus 3 sample shipments with
-- manifests. (Shipments still live in localStorage in v0.2.x, so the jobs
-- won't appear in the Jobs tab yet — they'll light up automatically once
-- Phase 3c lands. Trucks, crates, facilities, and users are visible now.)
--
-- Idempotent on legacy_id / email — re-runs upsert.

set search_path = public;

-- =====================================================================
-- facilities
-- =====================================================================
insert into facilities (legacy_id, code, name, city, address) values
  ('f-bk',  'BK',  'Brooklyn',         'Brooklyn, NY',     '63 Flushing Ave Brooklyn, NY 11205'),
  ('f-chi', 'CHI', 'Chicago',          'Chicago, IL',      '2552 W Ogden Ave Chicago, IL 60608'),
  ('f-la',  'LA',  'Los Angeles',      'Vernon, CA',       '4980 District Blvd Vernon, CA 90058'),
  ('f-atl', 'ATL', 'Atlanta',          'Atlanta, GA',      '100 Peachtree St NE Atlanta, GA 30303')
on conflict (code) do update set
  legacy_id = excluded.legacy_id,
  name      = excluded.name,
  city      = excluded.city,
  address   = excluded.address;

-- =====================================================================
-- non-admin demo users
-- (Your admin row is left alone; we only insert these new accounts.)
-- =====================================================================
insert into users (legacy_id, name, email, role, status, invited_at) values
  ('u-demo-1', 'Hana Koizumi',  'hana.demo@example.com',   'planner'::user_role,  'invited'::user_status, now()),
  ('u-demo-2', 'Marcus Reilly', 'marcus.demo@example.com', 'regional'::user_role, 'invited'::user_status, now()),
  ('u-demo-3', 'Diego Salgado', 'diego.demo@example.com',  'facility'::user_role, 'invited'::user_status, now()),
  ('u-demo-4', 'Fiona Carrick', 'fiona.demo@example.com',  'planner'::user_role,  'invited'::user_status, now()),
  ('u-demo-5', 'Pat O''Leary',  'pat.demo@example.com',    'viewer'::user_role,   'active'::user_status,  now())
on conflict (email) do update set
  name        = excluded.name,
  role        = excluded.role,
  status      = excluded.status,
  legacy_id   = excluded.legacy_id;

-- Facility access for the demo users
insert into user_facility_access (user_id, facility_id)
select u.id, f.id
from (values
  ('hana.demo@example.com',   'f-bk'),
  ('marcus.demo@example.com', 'f-bk'),
  ('marcus.demo@example.com', 'f-chi'),
  ('marcus.demo@example.com', 'f-la'),
  ('diego.demo@example.com',  'f-la'),
  ('fiona.demo@example.com',  'f-atl'),
  ('pat.demo@example.com',    'f-bk'),
  ('pat.demo@example.com',    'f-chi')
) as v(email, fac_legacy)
join users      u on u.email = v.email
join facilities f on f.legacy_id = v.fac_legacy
on conflict (user_id, facility_id) do nothing;

-- =====================================================================
-- trucks (use the new short type codes: Sprinter / ST / TT)
-- =====================================================================
insert into trucks (legacy_id, facility_id, ref, model, type, length_in, width_in, height_in, max_lbs, axles)
select v.legacy_id, f.id, v.ref, v.model, v.ttype::truck_type, v.l, v.w, v.h, v.lbs, v.ax
from (values
  ('t-bk-1',  'f-bk',  'BK-01',  'Mercedes Sprinter 3500',  'Sprinter', 170,  70,  79,  4500,  2),
  ('t-bk-2',  'f-bk',  'BK-02',  'Hino 268 26'' Box',       'ST',       312,  98, 102, 13000,  2),
  ('t-bk-3',  'f-bk',  'BK-03',  'Volvo VNL 53'' Trailer',  'TT',       636, 100, 110, 44000,  5),
  ('t-chi-1', 'f-chi', 'CHI-01', 'Mercedes Sprinter 3500',  'Sprinter', 170,  70,  79,  4500,  2),
  ('t-chi-2', 'f-chi', 'CHI-02', 'Freightliner M2 24'' Box','ST',       288,  96,  96, 11000,  2),
  ('t-la-1',  'f-la',  'LA-01',  'Mercedes Sprinter 3500',  'Sprinter', 170,  70,  79,  4500,  2),
  ('t-la-2',  'f-la',  'LA-02',  'Kenworth T680 53'' Trailer','TT',     636, 100, 110, 44000,  5),
  ('t-atl-1', 'f-atl', 'ATL-01', 'Hino 268 26'' Box',       'ST',       312,  98, 102, 13000,  2),
  ('t-atl-2', 'f-atl', 'ATL-02', 'Mercedes Sprinter 3500',  'Sprinter', 170,  70,  79,  4500,  2)
) as v(legacy_id, facility_legacy, ref, model, ttype, l, w, h, lbs, ax)
join facilities f on f.legacy_id = v.facility_legacy
on conflict (legacy_id) do update set
  facility_id = excluded.facility_id,
  ref       = excluded.ref,
  model     = excluded.model,
  type      = excluded.type,
  length_in = excluded.length_in,
  width_in  = excluded.width_in,
  height_in = excluded.height_in,
  max_lbs   = excluded.max_lbs,
  axles     = excluded.axles;

-- =====================================================================
-- crates  (inventory pool — home facility set per crate)
-- =====================================================================
insert into crates (
  legacy_id, ref, title, artist, year, medium,
  length_in, width_in, height_in, weight_lbs, value_cents,
  fragile, orient, stack, flat, glass, home_facility_id
)
select
  v.legacy_id, v.ref, v.title, v.artist, v.year, v.medium::medium_code,
  v.l, v.w, v.h, v.lbs, (v.value_dollars * 100)::bigint,
  v.fragile, v.orient::crate_orient, v.stack, v.flat, v.glass,
  f.id
from (values
  ('i-demo-01', 'CRT-1001', 'Cloud Study (oil)',          'Helena Voss',     2018, 'PNT', 52,  6, 42,  95,  32000, true,  'UP',  false, false, false, 'f-bk'),
  ('i-demo-02', 'CRT-1002', 'Bronze Figure no. 3',        'M. Andersen',     1981, 'SCL', 38, 38, 60, 520, 180000, true,  'UP',  false, false, false, 'f-bk'),
  ('i-demo-03', 'CRT-1003', 'Diptych — sea/sky',          'L. Okafor',       2007, 'PNT', 84,  6, 60, 210, 145000, true,  'UP',  false, false, true,  'f-bk'),
  ('i-demo-04', 'CRT-1004', 'Six Etchings (folio)',       'F. Bellori',      1994, 'WRK', 40,  4, 30,  32,  18000, true,  'UP',  true,  true,  false, 'f-bk'),
  ('i-demo-05', 'CRT-1005', 'Display plinth (oak)',       '—',               2024, 'MIX', 48, 24, 42, 140,      0, false, 'ANY', true,  false, false, 'f-bk'),
  ('i-demo-06', 'CRT-1006', 'Photograph (silver)',        'A. Park',         2010, 'PHT', 46,  4, 38,  38,  24000, true,  'UP',  false, false, false, 'f-bk'),
  ('i-demo-07', 'CRT-1007', 'Untitled (Marine)',          'Eluardo Reyes',   1962, 'PNT', 74,  8, 58, 142, 480000, true,  'UP',  false, false, false, 'f-chi'),
  ('i-demo-08', 'CRT-1008', 'Library of Glass',           'R. Kawamura',     2018, 'MIX', 60, 60, 84, 780, 1200000, true, 'UP',  false, false, true,  'f-chi'),
  ('i-demo-09', 'CRT-1009', 'Black Mountain Studies',     'C. Whitfield',    1957, 'WRK', 36,  3, 28,  22,  18000, true,  'UP',  true,  true,  false, 'f-chi'),
  ('i-demo-10', 'CRT-1010', 'Field Recording (II)',       'A. Park',         2011, 'PHT', 54,  4, 42,  45,  32000, true,  'UP',  true,  false, false, 'f-la'),
  ('i-demo-11', 'CRT-1011', 'Allegory (after Lotto)',     'P. Sarmento',     1988, 'PNT', 72,  6, 54, 120, 215000, true,  'UP',  false, false, false, 'f-la'),
  ('i-demo-12', 'CRT-1012', 'Maquette — Pavilion',        'M. Andersen',     1981, 'SCL', 36, 36, 36, 180,  78000, true,  'UP',  false, false, false, 'f-la'),
  ('i-demo-13', 'CRT-1013', 'Vessel, c.1820',             'Anonymous',       1820, 'DEC', 24, 24, 32,  88,  54000, true,  'UP',  false, false, false, 'f-atl'),
  ('i-demo-14', 'CRT-1014', 'Twelve Postcards',           'J. Meré',         2002, 'WRK', 30,  3, 24,  14,   8400, true,  'UP',  true,  true,  false, 'f-atl')
) as v(legacy_id, ref, title, artist, year, medium, l, w, h, lbs, value_dollars, fragile, orient, stack, flat, glass, home_legacy)
join facilities f on f.legacy_id = v.home_legacy
on conflict (legacy_id) do update set
  ref          = excluded.ref,
  title        = excluded.title,
  artist       = excluded.artist,
  year         = excluded.year,
  medium       = excluded.medium,
  length_in    = excluded.length_in,
  width_in     = excluded.width_in,
  height_in    = excluded.height_in,
  weight_lbs   = excluded.weight_lbs,
  value_cents  = excluded.value_cents,
  fragile      = excluded.fragile,
  orient       = excluded.orient,
  stack        = excluded.stack,
  flat         = excluded.flat,
  glass        = excluded.glass,
  home_facility_id = excluded.home_facility_id;

-- =====================================================================
-- shipments (forward-compat — won't show in the UI until Phase 3c)
-- =====================================================================
insert into shipments (legacy_id, ref, name, origin_facility_id, destination, pickup_date, status, notes)
select v.legacy_id, v.ref, v.name, f.id, v.dest, v.pickup::date, v.status::shipment_status, v.notes
from (values
  ('sh-demo-1', 'JOB-2026-0101', 'Smith collection — Brooklyn pickup',  'f-bk',  '12 W 27th St, New York NY',          '2026-06-04', 'planning', 'Two glass-flagged crates need sidewall placement.'),
  ('sh-demo-2', 'JOB-2026-0102', 'Wright commission — Chicago to LA',   'f-chi', 'MOCA, 250 S Grand Ave, Los Angeles', '2026-06-10', 'planning', 'Climate logger required.'),
  ('sh-demo-3', 'JOB-2026-0103', 'Atlanta Spring Sale — internal move', 'f-atl', 'Storage facility B-3, Atlanta',      '2026-05-29', 'ready',    '')
) as v(legacy_id, ref, name, origin_legacy, dest, pickup, status, notes)
join facilities f on f.legacy_id = v.origin_legacy
on conflict (legacy_id) do update set
  ref         = excluded.ref,
  name        = excluded.name,
  origin_facility_id = excluded.origin_facility_id,
  destination = excluded.destination,
  pickup_date = excluded.pickup_date,
  status      = excluded.status,
  notes       = excluded.notes;

-- shipment manifests
insert into shipment_crates (shipment_id, crate_id)
select s.id, c.id
from (values
  -- Brooklyn job — 4 crates
  ('sh-demo-1', 'i-demo-01'), ('sh-demo-1', 'i-demo-02'), ('sh-demo-1', 'i-demo-03'), ('sh-demo-1', 'i-demo-04'),
  -- Chicago → LA — 3 crates
  ('sh-demo-2', 'i-demo-07'), ('sh-demo-2', 'i-demo-08'), ('sh-demo-2', 'i-demo-09'),
  -- Atlanta internal — 2 crates
  ('sh-demo-3', 'i-demo-13'), ('sh-demo-3', 'i-demo-14')
) as v(ship_legacy, crate_legacy)
join shipments s on s.legacy_id = v.ship_legacy
join crates    c on c.legacy_id = v.crate_legacy
on conflict (shipment_id, crate_id) do nothing;

-- =====================================================================
-- summary
-- =====================================================================
do $$
declare
  fac_n int; truck_n int; user_n int; crate_n int; ship_n int; manifest_n int;
begin
  select count(*) into fac_n      from facilities;
  select count(*) into truck_n    from trucks;
  select count(*) into user_n     from users;
  select count(*) into crate_n    from crates;
  select count(*) into ship_n     from shipments;
  select count(*) into manifest_n from shipment_crates;
  raise notice 'Demo seed complete. Facilities: %, Trucks: %, Users: %, Crates: %, Shipments: %, Manifest links: %.',
    fac_n, truck_n, user_n, crate_n, ship_n, manifest_n;
end $$;
