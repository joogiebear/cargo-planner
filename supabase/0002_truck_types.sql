-- Allow the simplified truck type set: Sprinter / ST / TT.
-- Old enum values (Sprinter Van, 24'' Box, 26'' Box, 53'' Trailer, 24'' Box (EU))
-- stay in the type definition for backward compat with any historical rows.
-- Idempotent: re-runs are safe.

set search_path = public;

alter type truck_type add value if not exists 'Sprinter';
alter type truck_type add value if not exists 'ST';
alter type truck_type add value if not exists 'TT';
