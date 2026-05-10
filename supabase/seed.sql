-- Cargo Planner — seed reference data
-- Run AFTER schema.sql. Idempotent on legacy_id (uses upserts).
-- Only seeds facilities, users, user_facility_access, trucks, crates.
-- Shipments / scenarios / audit are user-generated and not seeded.

set search_path = public;

-- =====================================================================
-- facilities
-- =====================================================================
insert into facilities (legacy_id, code, name, city, address) values
  ('f-bk',  'BK',  'Brooklyn Navy Yard',    'New York, NY', '63 Flushing Ave'),
  ('f-lic', 'LIC', 'Long Island City Vault','Queens, NY',   '47-12 Austel Pl'),
  ('f-la',  'LA',  'Vernon Climate Vault',  'Vernon, CA',   '4980 District Blvd'),
  ('f-ldn', 'LDN', 'Park Royal Annex',      'London, UK',   'Premier Park Rd')
on conflict (legacy_id) do update set
  code    = excluded.code,
  name    = excluded.name,
  city    = excluded.city,
  address = excluded.address;

-- =====================================================================
-- users
-- =====================================================================
insert into users (legacy_id, name, email, role, status, invited_at) values
  ('u-01', 'Ines Vidal',    'ines@atelier-shipping.com',   'facility'::user_role, 'active'::user_status,  '2024-09-12'),
  ('u-02', 'Marcus Reilly', 'marcus@atelier-shipping.com', 'regional'::user_role, 'active'::user_status,  '2023-04-02'),
  ('u-03', 'Hana Koizumi',  'hana@atelier-shipping.com',   'planner'::user_role,  'active'::user_status,  '2024-11-30'),
  ('u-04', 'Diego Salgado', 'diego@atelier-shipping.com',  'facility'::user_role, 'active'::user_status,  '2024-02-18'),
  ('u-05', 'Olu Adebayo',   'olu@atelier-shipping.com',    'admin'::user_role,    'active'::user_status,  '2022-08-09'),
  ('u-06', 'Fiona Carrick', 'fiona@atelier-shipping.com',  'planner'::user_role,  'invited'::user_status, '2026-04-30'),
  ('u-07', 'Pat O''Leary',  'pat@atelier-shipping.com',    'viewer'::user_role,   'active'::user_status,  '2025-06-15')
on conflict (legacy_id) do update set
  name        = excluded.name,
  email       = excluded.email,
  role        = excluded.role,
  status      = excluded.status,
  invited_at  = excluded.invited_at;

-- =====================================================================
-- user_facility_access
-- =====================================================================
insert into user_facility_access (user_id, facility_id)
select u.id, f.id
from (values
  ('u-01', 'f-bk'),
  ('u-02', 'f-bk'),  ('u-02', 'f-lic'), ('u-02', 'f-la'),
  ('u-03', 'f-bk'),
  ('u-04', 'f-la'),
  ('u-05', 'f-bk'),  ('u-05', 'f-lic'), ('u-05', 'f-la'),  ('u-05', 'f-ldn'),
  ('u-06', 'f-ldn'),
  ('u-07', 'f-bk'),  ('u-07', 'f-lic')
) as v(user_legacy, facility_legacy)
join users      u on u.legacy_id = v.user_legacy
join facilities f on f.legacy_id = v.facility_legacy
on conflict (user_id, facility_id) do nothing;

-- =====================================================================
-- trucks
-- =====================================================================
insert into trucks (legacy_id, facility_id, ref, model, type, length_in, width_in, height_in, max_lbs, axles)
select v.legacy_id, f.id, v.ref, v.model, v.ttype::truck_type, v.l, v.w, v.h, v.lbs, v.ax
from (values
  ('t-1', 'f-bk',  'BK-04',  'Sprinter 3500',          'Sprinter Van',  170,  70,  79,  4500,  2),
  ('t-2', 'f-bk',  'BK-11',  'Hino 268 Box',           '26'' Box',      312,  98,  102, 13000, 2),
  ('t-3', 'f-bk',  'BK-22',  'Volvo VNL 53''',         '53'' Trailer',  636, 100, 110,  44000, 5),
  ('t-4', 'f-lic', 'LIC-02', 'Freightliner M2 24''',   '24'' Box',      288,  96,  96,  11000, 2),
  ('t-5', 'f-la',  'LA-07',  'Kenworth T680 53''',     '53'' Trailer',  636, 100, 110,  44000, 5),
  ('t-6', 'f-ldn', 'LDN-01', 'Mercedes Atego 18t',     '24'' Box (EU)', 280,  96, 100,  17600, 2)
) as v(legacy_id, facility_legacy, ref, model, ttype, l, w, h, lbs, ax)
join facilities f on f.legacy_id = v.facility_legacy
on conflict (legacy_id) do update set
  facility_id = excluded.facility_id,
  ref         = excluded.ref,
  model       = excluded.model,
  type        = excluded.type,
  length_in   = excluded.length_in,
  width_in    = excluded.width_in,
  height_in   = excluded.height_in,
  max_lbs     = excluded.max_lbs,
  axles       = excluded.axles;

-- =====================================================================
-- crates  (prototype "items"; value is whole-dollar in prototype → cents here)
-- All seeded crates default to home facility = Brooklyn (f-bk) — adjust later.
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
  ('i-01', 'CRT-9412', 'Untitled (Marine)',         'Eluardo Reyes', 1962, 'PNT', 74,  8, 58, 142,  480000,  true,  'UP',  false, false, false),
  ('i-02', 'CRT-9413', 'Form III (bronze)',         'M. Andersen',   1979, 'SCL', 42, 42, 66, 610,  920000,  true,  'UP',  false, false, false),
  ('i-03', 'CRT-9414', 'Diptych no. 4 (glass)',     'L. Okafor',     2004, 'PNT', 96,  6, 72, 215,  165000,  true,  'UP',  false, false, true),
  ('i-04', 'CRT-9415', 'Vessel, c.1820',            'Anonymous',     1820, 'DEC', 24, 24, 32, 88,    54000,  true,  'UP',  false, false, false),
  ('i-05', 'CRT-9416', 'Library of Glass',          'R. Kawamura',   2018, 'MIX', 60, 60, 84, 780, 1200000,  true,  'UP',  false, false, true),
  ('i-06', 'CRT-9417', 'Six Studies',               'F. Bellori',    1996, 'WRK', 48,  4, 36, 38,    24000,  true,  'UP',  true,  true,  false),
  ('i-07', 'CRT-9418', 'Field Recording (II)',      'A. Park',       2011, 'PHT', 54,  4, 42, 45,    32000,  true,  'UP',  true,  false, false),
  ('i-08', 'CRT-9419', 'Black Mountain Studies',    'C. Whitfield',  1957, 'WRK', 36,  3, 28, 22,    18000,  true,  'UP',  true,  true,  false),
  ('i-09', 'CRT-9420', 'Plinth, white oak',         '—',             2024, 'MIX', 48, 24, 42, 140,       0,  false, 'ANY', true,  false, false),
  ('i-10', 'CRT-9421', 'Crate, archival foam',      '—',             2024, 'MIX', 60, 36, 36, 65,        0,  false, 'ANY', true,  false, false),
  ('i-11', 'CRT-9422', 'Allegory (after Lotto)',    'P. Sarmento',   1988, 'PNT', 72,  6, 54, 120,  215000,  true,  'UP',  false, false, false),
  ('i-12', 'CRT-9423', 'Maquette — Pavilion',       'M. Andersen',   1981, 'SCL', 36, 36, 36, 180,   78000,  true,  'UP',  false, false, false),
  ('i-13', 'CRT-9424', 'Untitled (Sky), glass',     'E. Reyes',      1968, 'PNT', 84,  8, 60, 185,  520000,  true,  'UP',  false, false, true),
  ('i-14', 'CRT-9425', 'Twelve Postcards',          'J. Meré',       2002, 'WRK', 30,  3, 24, 14,     8400,  true,  'UP',  true,  true,  false)
) as v(legacy_id, ref, title, artist, year, medium, l, w, h, lbs, value_dollars, fragile, orient, stack, flat, glass)
join facilities f on f.legacy_id = 'f-bk'
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
  glass        = excluded.glass;

-- =====================================================================
-- sanity check
-- =====================================================================
do $$
begin
  raise notice 'Seed complete. Facilities: %, Users: %, Trucks: %, Crates: %',
    (select count(*) from facilities),
    (select count(*) from users),
    (select count(*) from trucks),
    (select count(*) from crates);
end $$;
