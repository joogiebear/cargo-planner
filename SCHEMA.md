# Cargo Planner — Database Schema

> Handoff doc for migrating the Cargo Planner prototype off of `localStorage` and onto a real backend. Derived from the live data shapes used by the React prototype.
>
> Target: **PostgreSQL 14+**. All `id` columns are application-generated short strings (e.g. `f-bk`, `t-3`, `i-01`) in the prototype; production should use `uuid` PKs and keep the prototype IDs as a `legacy_id` column on each table for one-time data import.
>
> Conventions
> - `created_at` / `updated_at` are `timestamptz NOT NULL DEFAULT now()` on every table; omitted from column lists below for brevity.
> - All foreign keys are `ON DELETE RESTRICT` unless noted.
> - All `text` lengths are advisory; tighten with `CHECK (char_length(...))` in production.
> - Money values are `bigint` cents (USD); the prototype stores whole-dollar `int`s in `value`.
> - Dimensions are stored in **inches**; weights in **pounds**. Don't introduce unit conversion at the column level — keep the source units and convert in the app or a view.

---

## Entity overview

```
facilities ──┬─< trucks
             ├─< user_facility_access >── users
             └─< shipments ──< shipment_crates >── crates
                                       │
                                       └─< scenarios ──< scenario_assignments >── trucks
                                                                                   │
                                                                                   └── crates

audit_log (append-only)
```

---

## `facilities`

Physical warehouse locations. A truck and a user are scoped to one or more facilities.

| Column     | Type           | Notes                                       |
|------------|----------------|---------------------------------------------|
| `id`       | `uuid` PK      |                                             |
| `code`     | `text` UNIQUE  | Short code, e.g. `BK`, `LIC`, `LA`, `LDN`.  |
| `name`     | `text` NOT NULL| `Brooklyn Navy Yard`                         |
| `city`     | `text`         | `New York, NY`                               |
| `address`  | `text`         |                                             |
| `archived` | `boolean` NOT NULL DEFAULT `false` | Soft delete.        |

Indexes
- `UNIQUE (code)`
- `(archived)` for filtering active.

---

## `users`

Planner / manager / viewer accounts.

| Column          | Type      | Notes                                                 |
|-----------------|-----------|-------------------------------------------------------|
| `id`            | `uuid` PK |                                                       |
| `name`          | `text` NOT NULL |                                                 |
| `email`         | `text` UNIQUE NOT NULL |                                          |
| `role`          | `user_role` NOT NULL | enum: see below.                          |
| `status`        | `user_status` NOT NULL DEFAULT `'active'` | enum: see below. |
| `invited_at`    | `timestamptz` NOT NULL |                                          |
| `last_seen_at`  | `timestamptz` |                                                  |

```sql
CREATE TYPE user_role   AS ENUM ('admin', 'regional', 'facility', 'planner', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'invited', 'suspended');
```

Indexes
- `UNIQUE (email)`
- `(role)`

### Role semantics (enforced in app + RLS)

| Role        | Plans | Manifest | Trucks | Users | Facilities | Org |
|-------------|-------|----------|--------|-------|------------|-----|
| `admin`     | ✓     | ✓        | ✓      | ✓     | ✓          | ✓   |
| `regional`  | ✓     | ✓        | ✓      | —     | —          | —   |
| `facility`  | ✓     | ✓        | ✓      | —     | —          | —   |
| `planner`   | ✓     | ✓        | —      | —     | —          | —   |
| `viewer`    | —     | —        | —      | —     | —          | —   |

---

## `user_facility_access`

Many-to-many between `users` and `facilities`. Admins implicitly have access to all facilities (handled in app/RLS, not in this table).

| Column       | Type      | Notes                                |
|--------------|-----------|--------------------------------------|
| `user_id`    | `uuid` FK → `users.id`     | `ON DELETE CASCADE`     |
| `facility_id`| `uuid` FK → `facilities.id`| `ON DELETE CASCADE`     |
| `granted_by` | `uuid` FK → `users.id`     |                          |
| `granted_at` | `timestamptz` NOT NULL DEFAULT `now()` |             |

PK: composite `(user_id, facility_id)`.

---

## `trucks`

Fleet vehicles. Each truck is owned by exactly one facility.

| Column        | Type      | Notes                                               |
|---------------|-----------|-----------------------------------------------------|
| `id`          | `uuid` PK |                                                     |
| `facility_id` | `uuid` FK → `facilities.id` NOT NULL |                  |
| `ref`         | `text` NOT NULL | e.g. `BK-04`. Unique per facility.            |
| `model`       | `text` NOT NULL | `Sprinter 3500`                               |
| `type`        | `truck_type` NOT NULL | enum below.                             |
| `length_in`   | `int` NOT NULL CHECK > 0 | Interior length, inches.            |
| `width_in`    | `int` NOT NULL CHECK > 0 |                                      |
| `height_in`   | `int` NOT NULL CHECK > 0 |                                      |
| `max_lbs`     | `int` NOT NULL CHECK > 0 | Max payload.                         |
| `axles`       | `smallint` NOT NULL DEFAULT 2 |                                 |
| `out_of_service` | `boolean` NOT NULL DEFAULT `false` |                       |

```sql
CREATE TYPE truck_type AS ENUM ('Sprinter Van', '24'' Box', '26'' Box', '53'' Trailer', '24'' Box (EU)');
```

Indexes
- `UNIQUE (facility_id, ref)`
- `(facility_id, out_of_service)`

---

## `crates`

A single packed crate (the prototype calls these "items"). Lives independently of any shipment so it can be reassigned over time.

| Column     | Type      | Notes                                                          |
|------------|-----------|----------------------------------------------------------------|
| `id`       | `uuid` PK |                                                                |
| `ref`      | `text` UNIQUE NOT NULL | e.g. `CRT-9412`.                                  |
| `title`    | `text` NOT NULL | Artwork title.                                          |
| `artist`   | `text`    |                                                                |
| `year`     | `smallint` |                                                               |
| `medium`   | `medium_code` NOT NULL | enum below.                                       |
| `length_in`| `int` NOT NULL CHECK > 0 |                                                |
| `width_in` | `int` NOT NULL CHECK > 0 |                                                |
| `height_in`| `int` NOT NULL CHECK > 0 |                                                |
| `weight_lbs`| `int` NOT NULL CHECK > 0 |                                                |
| `value_cents` | `bigint` DEFAULT 0 | Insured value in USD cents. Prototype: `value` whole $. |
| `fragile`  | `boolean` NOT NULL DEFAULT `true`  | Handle care.                       |
| `orient`   | `crate_orient` NOT NULL DEFAULT `'UP'` | enum: `'UP' | 'ANY'`.            |
| `stack`    | `boolean` NOT NULL DEFAULT `false` | OK to stack other crates on top.   |
| `flat`     | `boolean` NOT NULL DEFAULT `false` | Must lie flat (works on paper).    |
| `glass`    | `boolean` NOT NULL DEFAULT `false` | Must hug a side wall, long edge ‖. |
| `home_facility_id` | `uuid` FK → `facilities.id` | Where it currently lives.   |

```sql
CREATE TYPE medium_code  AS ENUM ('PNT', 'SCL', 'WRK', 'MIX', 'DEC', 'PHT');
CREATE TYPE crate_orient AS ENUM ('UP', 'ANY');
```

Indexes
- `UNIQUE (ref)`
- `(home_facility_id)`
- `(medium)`

Reference: medium_code labels
- `PNT` Painting · `SCL` Sculpture · `WRK` Work on paper · `MIX` Installation · `DEC` Decorative arts · `PHT` Photograph

---

## `shipments`

A planned movement of crates from an origin facility to a destination.

| Column        | Type      | Notes                                              |
|---------------|-----------|----------------------------------------------------|
| `id`          | `uuid` PK |                                                    |
| `ref`         | `text` UNIQUE NOT NULL | e.g. `SHP-2026-0142`.                 |
| `name`        | `text` NOT NULL | Human-friendly title.                       |
| `origin_facility_id` | `uuid` FK → `facilities.id` NOT NULL |              |
| `destination` | `text` NOT NULL | Free-text (often external — gallery, museum, port). |
| `pickup_date` | `date`    |                                                    |
| `arrive_window_start` | `date` |                                              |
| `arrive_window_end`   | `date` |                                              |
| `handler_user_id` | `uuid` FK → `users.id` |                              |
| `status`      | `shipment_status` NOT NULL DEFAULT `'planning'` |        |
| `loaded_at`   | `timestamptz` | Set when status flips to `loaded`.           |
| `notes`       | `text`    |                                                    |

```sql
CREATE TYPE shipment_status AS ENUM ('planning', 'ready', 'loaded', 'in_transit', 'delivered', 'archived');
```

Indexes
- `UNIQUE (ref)`
- `(origin_facility_id, status)`
- `(handler_user_id)`

---

## `shipment_crates`

Which crates belong to which shipment. A crate can only be in one active shipment at a time (enforced by partial unique index).

| Column       | Type      | Notes                              |
|--------------|-----------|------------------------------------|
| `shipment_id`| `uuid` FK → `shipments.id` ON DELETE CASCADE | |
| `crate_id`   | `uuid` FK → `crates.id`    ON DELETE RESTRICT | |
| `added_at`   | `timestamptz` NOT NULL DEFAULT `now()` | |

PK: `(shipment_id, crate_id)`.

Constraint
```sql
CREATE UNIQUE INDEX one_active_shipment_per_crate
  ON shipment_crates (crate_id)
  WHERE EXISTS (
    SELECT 1 FROM shipments s
    WHERE s.id = shipment_crates.shipment_id
      AND s.status NOT IN ('delivered', 'archived')
  );
```
(In practice this is easier as an app-level invariant; the partial-index form above is illustrative.)

---

## `scenarios`

A saved load plan for a shipment — alternate truck combinations + crate placements.

| Column         | Type      | Notes                                                |
|----------------|-----------|------------------------------------------------------|
| `id`           | `uuid` PK |                                                      |
| `name`         | `text` NOT NULL | `Frieze Pickup — BK→LDN (2-truck)`.            |
| `shipment_id`  | `uuid` FK → `shipments.id` ON DELETE CASCADE |          |
| `facility_id`  | `uuid` FK → `facilities.id` |                          |
| `status`       | `scenario_status` NOT NULL DEFAULT `'draft'` |          |
| `author_user_id` | `uuid` FK → `users.id` |                            |
| `summary`      | `jsonb` NOT NULL | Cached: `{ trucks, crates, util, weight }`.    |

```sql
CREATE TYPE scenario_status AS ENUM ('draft', 'active', 'archived');
```

`summary` shape (denormalized for fast list rendering):
```json
{ "trucks": 2, "crates": 5, "util": 64, "weight": 41 }
```

Indexes
- `(shipment_id, status)`
- `(facility_id)`
- `(author_user_id)`

---

## `scenario_assignments`

Per-crate placement decisions inside a scenario. This is what the prototype's `snapshot.assignments` becomes.

| Column        | Type      | Notes                                       |
|---------------|-----------|---------------------------------------------|
| `scenario_id` | `uuid` FK → `scenarios.id` ON DELETE CASCADE |       |
| `crate_id`    | `uuid` FK → `crates.id` |                          |
| `truck_id`    | `uuid` FK → `trucks.id` |                          |
| `position`    | `jsonb`   | Optional: `{ x, y, z, rotated }` from packer. |
| `seq`         | `int`     | Load order (lower = on first, off last).    |

PK: `(scenario_id, crate_id)`.

Indexes
- `(scenario_id, truck_id)`
- `(truck_id, scenario_id)`

Also store the **fleet** that the scenario uses — even trucks with no crates:

### `scenario_trucks`

| Column        | Type      | Notes                                       |
|---------------|-----------|---------------------------------------------|
| `scenario_id` | `uuid` FK → `scenarios.id` ON DELETE CASCADE |       |
| `truck_id`    | `uuid` FK → `trucks.id` |                          |

PK: composite. This lets you reconstruct an empty truck tab in a saved plan.

---

## `audit_log`

Append-only event stream. The prototype already writes to this for save/optimize/load actions.

| Column      | Type      | Notes                                                |
|-------------|-----------|------------------------------------------------------|
| `id`        | `bigserial` PK | |
| `t`         | `timestamptz` NOT NULL DEFAULT `now()` | |
| `actor_user_id` | `uuid` FK → `users.id` | Nullable for system events. |
| `kind`      | `audit_kind` NOT NULL | enum: see below. |
| `action`    | `text` NOT NULL | Short verb phrase: `Saved scenario`. |
| `target`    | `text`    | Descriptive target: `Frieze Pickup — BK→LDN (2-truck)`. |
| `entity_type` | `text`  | Optional: `scenario`, `shipment`, `truck`, etc. |
| `entity_id` | `uuid`    | Optional FK-shaped reference (no constraint — entity may be deleted). |
| `meta`      | `jsonb`   | Open payload for action-specific detail. |

```sql
CREATE TYPE audit_kind AS ENUM ('edit', 'create', 'delete', 'auth', 'system');
```

Indexes
- `(t DESC)` for recent-first scans.
- `(actor_user_id, t DESC)`
- `(entity_type, entity_id, t DESC)`

Retention: cap at ~200 entries in the prototype; in production keep indefinitely or move to a partitioned table by month.

---

## Row-level security (RLS) sketch

Enable RLS on every table. Sample policy for `shipments`:

```sql
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipments_read ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_setting('app.user_id')::uuid
        AND (
          u.role = 'admin'
          OR EXISTS (
            SELECT 1 FROM user_facility_access ufa
            WHERE ufa.user_id = u.id
              AND ufa.facility_id = shipments.origin_facility_id
          )
        )
    )
  );

CREATE POLICY shipments_write ON shipments
  FOR INSERT WITH CHECK ( /* same as above, plus role IN ('admin','regional','facility','planner') */ );
```

Apply analogous policies to `trucks`, `crates`, `scenarios`, `scenario_assignments`, `audit_log` (write-only via app for non-admins).

---

## Initial migration plan

1. Create types and tables in dependency order: `facilities` → `users` → `user_facility_access` → `trucks` → `crates` → `shipments` → `shipment_crates` → `scenarios` → `scenario_trucks` → `scenario_assignments` → `audit_log`.
2. Use the prototype's **Export all data (JSON)** action (Admin → Org → Export) to dump current state.
3. For each top-level array in the JSON, run a one-off seed script that maps prototype IDs → fresh UUIDs, persisting the mapping in a temp table for FK rewriting.
4. Replay the audit log last (so FK references resolve).
5. Switch the React app's `CP_STORE` shim to call the API instead of `localStorage`. Public surface stays the same: `get(key, default)`, `set(key, value)`, `subscribe(fn)`, `appendAudit(evt)`.

---

## What the prototype does NOT model yet

These are intentionally out of scope right now — flag them when you build the backend so you don't paint yourself into a corner:

- **Multi-stop routes.** Today a shipment is origin → single destination. Real fine-arts moves often have 2–4 stops. Add `shipment_stops` (ordered child table) when ready.
- **Driver / dispatch.** Per spec, this app is **planning only** — no driver assignment, no live route.
- **Customer / consignor records.** Destinations are free-text. A `parties` table (galleries, museums, collectors) would normalize this.
- **Climate / handling logs.** The seed scenario notes mention climate loggers; no schema for them yet.
- **Inventory / location-within-facility.** A crate sits at a `home_facility` but we don't track which rack/shelf/room.
