-- Phase 3c — make shipments cross-device.
-- Adds a metadata jsonb column for app-specific extras that aren't in
-- the core schema (handler name, priority, climate, arrive window text).
-- Idempotent.

set search_path = public;

alter table shipments
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Helpful index for ordering Jobs lists newest-first
create index if not exists idx_shipments_created_at on shipments(created_at desc);
