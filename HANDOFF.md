# Cargo Planner — Developer Handoff

A planning-only load-planning tool for a fine-arts shipping & storage company. Lets facility managers (Brooklyn / LIC / Vernon / London) plan how their assigned trucks will be packed for outgoing shipments, with constraint-aware bin-packing, multi-truck scenarios, role-gated access, and an audit trail.

**Not in scope:** dispatching, driver assignment, route tracking, accounting.

---

## What's in this bundle

| File | Purpose |
|---|---|
| `Cargo Planner.html` | Entry point. Open in any modern browser. |
| `app.jsx` | Main React app — top nav, facility switcher, Load Plan view, drag-to-assign, optimize animation, persistence shim, print sheets. |
| `pages.jsx` | Shipments / Trucks / Scenarios pages, scenario compare dialog. |
| `admin.jsx` | Admin pages — Users, Facilities, Roles, Audit, Data (export/import + live entity inspector). |
| `viz.jsx` | CSS-3D truck visualization (Iso / 3D / Top views) + bin packer. |
| `tweaks-panel.jsx` | Floating tweaks panel (theme, view mode, density, label visibility). |
| `data.js` | Seed reference data — facilities, trucks, crates, mediums. |
| `styles.css`, `pages.css`, `admin.css` | Editorial-premium design system. |
| `SCHEMA.md` | **Database schema spec** — your starting point for the backend. |
| `HANDOFF.md` | This file. |

No build step. No package.json. Open `Cargo Planner.html` directly.

---

## Architecture (current state — prototype)

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  ┌───────────────────────────────────────────────┐  │
│  │  React 18 (UMD) + Babel standalone (in-page)  │  │
│  │  ├── app.jsx         (root, routing, state)   │  │
│  │  ├── pages.jsx       (lists)                  │  │
│  │  ├── admin.jsx       (admin)                  │  │
│  │  ├── viz.jsx         (3D viz + packer)        │  │
│  │  └── tweaks-panel.jsx                         │  │
│  └───────────────────────────────────────────────┘  │
│                       │                             │
│                       ▼                             │
│  CP_STORE — { get, set, subscribe, appendAudit }   │
│                       │                             │
│                       ▼                             │
│  localStorage["cp_v1"]                              │
└─────────────────────────────────────────────────────┘
```

**State seam.** Everything that should eventually round-trip to a backend goes through `CP_STORE` (defined at the top of `app.jsx`). Its public surface:

```js
window.CP_STORE = {
  get(key, defaultValue),   // sync read
  set(key, value),          // sync write + notify subscribers
  subscribe(fn),            // fn(changedKey) called on every write
  appendAudit(event),       // append-only helper for audit_log
};
```

To move to a real backend, **replace this single object** with one whose `get/set` calls hit your API. The rest of the app already routes through it.

Keys currently used: `shipments`, `scenarios`, `users`, `audit`, `activeUserId`, `facilityId`, `theme`, plus per-page UI prefs.

---

## Data model

See **`SCHEMA.md`** for the full Postgres spec.

Entity overview:

```
facilities ──┬─< trucks
             ├─< user_facility_access >── users
             └─< shipments ──< shipment_crates >── crates
                                       │
                                       └─< scenarios ──< scenario_assignments >── trucks + crates

audit_log (append-only)
```

Entry points for inspection:
- **Live shape & counts in-app:** Admin → Data tab → "Live data model" section. Click any entity to see fields + sample record.
- **JSON export:** Admin → Data tab → "Download JSON" — bundles everything (seed + live) into one file matching the spec in `SCHEMA.md`.

---

## Roles & permissions

Defined in `admin.jsx` as `window.CP_CAN_EDIT(role, area)`. Five roles, six gated areas (`plans`, `manifest`, `trucks`, `users`, `facilities`, `org`):

| Role | Plans | Manifest | Trucks | Users | Facilities | Org |
|---|---|---|---|---|---|---|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `regional` | ✓ | ✓ | ✓ | — | — | — |
| `facility` | ✓ | ✓ | ✓ | — | — | — |
| `planner` | ✓ | ✓ | — | — | — | — |
| `viewer` | — | — | — | — | — | — |

Users are scoped to one or more facilities via `user_facility_access`; admins implicitly have all. The "Acting as…" picker in the top bar switches the active user — useful for QA'ing role behaviour without separate sessions. It persists across reloads.

When you wire real auth, the same gating logic should run in **two places**: client (to hide UI) and server (Postgres RLS — sketched in `SCHEMA.md`).

---

## Key flows for a developer to verify after backend wire-up

1. **Login as Marcus (Regional, BK/LIC/LA)** — should see facility switcher with three options, full edit access on Load Plan and Trucks, no Admin tab.
2. **Login as Pat (Viewer, BK/LIC)** — should see read-only banner, no Optimize / Save / Add buttons, Admin hidden.
3. **Plan a shipment end-to-end** — Shipments → open SHP-2026-0142 → drag manifest crates onto trucks → Optimize → Save scenario → reopen scenario → "Mark loaded".
4. **Compare two saved scenarios** — Scenarios → check two cards → Compare → diff view should show every crate's truck assignment per scenario, with rows differing in placement highlighted.
5. **Audit trail** — every save / optimize / mark-loaded / add-truck should appear in Admin → Audit, attributed to the active user with timestamp.

---

## Migration plan

Step-by-step from prototype to production:

**Phase 1 — Backend stand-up**
1. Read `SCHEMA.md` end-to-end.
2. Run the migrations (in dependency order: facilities → users → user_facility_access → trucks → crates → shipments → shipment_crates → scenarios → scenario_trucks → scenario_assignments → audit_log).
3. Seed reference data (facilities, trucks, crates, roles) from `data.js` or from the JSON export.
4. Build CRUD endpoints for each entity. The shapes are literally what `CP_STORE.get(key)` returns.

**Phase 2 — Auth**
5. Wire your auth provider. Set a `current_user_id` session var that RLS policies can read.
6. Implement RLS policies (sketch in `SCHEMA.md`).

**Phase 3 — Client wire-up**
7. Replace the `CP_STORE` IIFE in `app.jsx` with one that calls your API. Keep the same 4-method surface (`get`, `set`, `subscribe`, `appendAudit`).
8. The components don't need to change — they all consume `CP_STORE` through `usePersist` / `usePgState`.
9. Replace the "Acting as…" switcher with your real auth's account menu (or keep it as a debug-only toggle, gated by a feature flag).

**Phase 4 — Pack & ship**
10. Add a real build step (Vite or similar) — Babel-in-browser is fine for design but slow on first paint.
11. Move JSX files to a proper `src/` tree, add typing if desired (the data shapes lift cleanly into TypeScript interfaces — `SCHEMA.md` columns map 1:1).

---

## Things the prototype intentionally does NOT model

Flag these early so they don't become surprises:

- **Multi-stop routes.** Today: one origin → one destination. Real fine-arts moves often have 2–4 stops. Add `shipment_stops` (ordered child table) when ready.
- **Driver / dispatch.** Per spec, planning only.
- **Customer / consignor records.** Destinations are free-text. A `parties` table (galleries, museums, collectors) would normalize this.
- **Climate / handling logs.** Notes mention climate loggers; no schema yet.
- **Inventory / location-within-facility.** Crates have a `home_facility` but no rack/shelf/room.
- **Real-time collaboration.** No presence, no concurrent-edit conflict resolution. WebSocket layer would slot in alongside `CP_STORE.subscribe`.

---

## Bin-packing algorithm

Lives in `viz.jsx`. Constraint-aware first-fit-decreasing:

1. Sort crates by volume desc.
2. Apply constraints in order: GLASS (must hug a side wall, long edge ‖ truck length) → FLAT (smallest dimension becomes height) → orient/UP (no rotation that puts the marked face down).
3. Stack onto existing crates only if the lower crate has `stack: true`.
4. Balance check at end — if center-of-mass is more than 15% off-center, surface a warning.

When you move this server-side, keep the constraint precedence the same — planners rely on it.

---

## Open questions for the product owner

1. Should `home_facility` on a crate auto-update when it's loaded onto a truck whose destination is a different facility? Today: no. The crate stays at its origin facility in the data model.
2. Should saved scenarios be attached to a specific shipment (1:N as in `SCHEMA.md`) or to a shipment + a date window (so you can have "next week" vs "this week" plans)?
3. Should the audit log capture before/after diffs for edits, or just action verbs? Currently just verbs.
4. Permissions — should `planner` role have read-only access to other facilities they're not assigned to, or zero visibility? Currently zero.

---

## Contact / next steps

This bundle is a working prototype meant to validate UX and the data model. Once a developer is comfortable with `SCHEMA.md` and the `CP_STORE` seam, the migration is straightforward — most of the surface area is read/write through that one shim.

Recommended order: stand up backend → migrate one entity at a time (`facilities` first, `audit_log` last), keeping the prototype's localStorage fallback in place during the transition so you can swap entities individually.
